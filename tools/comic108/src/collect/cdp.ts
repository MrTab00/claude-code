/**
 * CDP 采集: 连接你已经登录的 Chrome, 被动读取页面自己发出的 GraphQL 响应。
 *
 * 为什么是被动捕获而不是构造请求:
 * X 每 2-4 周就会轮换 GraphQL 的 doc_id 并变更 features 参数, 所有自己拼请求的爬虫都会周期性失效。
 * 而页面前端永远知道怎么正确地请求自己的接口 —— 我们只是把它的响应抄一份下来, 所以不受轮换影响。
 *
 * 这里不做任何反检测 / 指纹伪装 / 验证码绕过: 用你自己的登录态, 低频率, 只读公开内容。
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { collect as collectConfig, paths } from '../../config';
import { collectTweetNodes } from '../parse/extract';
import type { RawCapture } from '../types';
import { type CdpConnection, type CdpPage, connectCdp, getResponseBody, openPage } from './cdp-client';
import { PROFILE_DIR, endpointAlive, launchChrome, manualCommand } from './launch';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function randomDelay(): number {
    const [min, max] = collectConfig.scrollDelayMs;
    return min + Math.random() * (max - min);
}

function slugify(query: string): string {
    return query.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '').slice(0, 40) || 'query';
}

/** URL 从 operation 名判断是否是我们要的响应。doc_id 的 hash 会被 X 定期轮换, 所以只看名字 */
export function matchOperation(url: string): string | null {
    if (!url.includes('/i/api/graphql/')) return null;
    let op: string;
    try {
        op = new URL(url).pathname.split('/').pop() ?? '';
    } catch {
        return null;
    }
    return collectConfig.operations.test(op) ? op : null;
}

export interface Capture {
    readonly seenTweets: Set<string>;
    readonly captures: number;
    detach(): Promise<void>;
}

/**
 * 给一个页面挂上响应监听, 把命中的 GraphQL 响应原样追加到 jsonl。
 * 与 x.com 无关 —— 所以可以用本地假页面完整测试这段逻辑。
 */
export function attachCapture(conn: CdpConnection, page: CdpPage, file: string, query: string): Capture {
    const seenTweets = new Set<string>();
    const watching = new Map<string, string>(); // requestId -> url
    let captures = 0;
    let pending = 0;

    const offResponse = conn.on('Network.responseReceived', (params, sid) => {
        if (sid !== page.sessionId) return;
        const url = String((params.response as { url?: string })?.url ?? '');
        if (matchOperation(url)) watching.set(String(params.requestId), url);
    });

    // 応答本体は loadingFinished を待たないと取れない
    const offFinished = conn.on('Network.loadingFinished', (params, sid) => {
        if (sid !== page.sessionId) return;
        const requestId = String(params.requestId);
        const url = watching.get(requestId);
        if (!url) return;
        watching.delete(requestId);

        pending++;
        void (async () => {
            try {
                const raw = await getResponseBody(conn, requestId, page.sessionId);
                if (!raw) return;
                const body = JSON.parse(raw);
                const capture: RawCapture = {
                    op: matchOperation(url) ?? 'unknown',
                    url,
                    capturedAt: new Date().toISOString(),
                    query,
                    body,
                };
                await appendFile(file, `${JSON.stringify(capture)}\n`, 'utf8');
                captures++;
                for (const id of collectTweetNodes(body).keys()) seenTweets.add(id);
            } catch {
                // JSON でない / 既に破棄された応答は黙って捨てる
            } finally {
                pending--;
            }
        })();
    });

    return {
        seenTweets,
        get captures() {
            return captures;
        },
        async detach() {
            // 走査中の書き込みを取りこぼさないよう、落ち着くまで待つ
            for (let i = 0; i < 100 && pending > 0; i++) await sleep(100);
            offResponse();
            offFinished();
        },
    };
}

export interface ScrollOptions {
    label?: string;
    maxTweets?: number;
    /** 1 回のスクロール後の待ち時間(ms)。テストから短縮するために差し替えられる */
    delay?: () => number;
}

/**
 * 慢慢往下滚, 直到「已经到底、而且没有新推文」为止。
 *
 * 「新しいツイートが増えない」だけで打ち切ってはいけない: 既に読み込み済みの
 * 24 件ぶんを下っている最中は当然増えないし、タイムラインが次のページを取りに行くのは
 * 下端に近づいた時だけ。途中で諦めると 1 ページ目しか採れない。
 * だから空転として数えるのは、下端に到達した(もしくはもう動かない)場合に限る。
 */
export async function autoScroll(page: CdpPage, capture: Capture, options: ScrollOptions = {}): Promise<void> {
    const { label = '', maxTweets = collectConfig.maxTweetsPerQuery, delay = randomDelay } = options;

    // scrollTop への代入は smooth 指定の影響を受けず必ず即時に効く
    const step = `(() => {
        const e = document.scrollingElement || document.documentElement;
        e.scrollTop = e.scrollTop + window.innerHeight * 1.5;
        return { y: e.scrollTop, h: window.innerHeight, total: e.scrollHeight };
    })()`;

    let idle = 0;
    let lastCount = 0;
    let lastY = -1;

    for (let round = 0; round < 2000; round++) {
        if (capture.seenTweets.size >= maxTweets || idle >= collectConfig.idleRoundsBeforeStop) break;

        const m = await page.evaluate<{ y: number; h: number; total: number }>(step);
        await sleep(delay());

        const grew = capture.seenTweets.size > lastCount;
        const moved = m.y > lastY + 8;
        const atBottom = m.y + m.h >= m.total - 400;

        if (grew) {
            idle = 0;
            lastCount = capture.seenTweets.size;
            if (label) process.stdout.write(`\r    ${label} — ${capture.seenTweets.size} 件`);
        } else if (atBottom || !moved) {
            idle++;
        } else {
            idle = 0; // まだ既読分を下っている途中
        }

        lastY = m.y;
    }
}

/** Enter が押されるまで待つ */
function waitForEnter(): Promise<void> {
    return new Promise((resolve) => {
        process.stdin.resume();
        process.stdin.once('data', () => {
            process.stdin.pause();
            resolve();
        });
    });
}

/**
 * 繋がらなければ Chrome を起動してから繋ぐ。
 * 手で長いコマンドを打たせないためで、--no-launch で従来どおり手動起動にもできる。
 */
export async function connect(autoLaunch = true): Promise<CdpConnection> {
    const endpoint = collectConfig.cdpEndpoint;

    if (!(await endpointAlive(endpoint))) {
        if (!autoLaunch) {
            throw new Error(
                `Chrome に接続できませんでした (${endpoint})\n\n` +
                    'リモートデバッグ付きで起動してください:\n  ' +
                    manualCommand(Number(new URL(endpoint).port || 9222)),
            );
        }
        console.log('  Chrome が起動していないので起動します...');
        await launchChrome({ endpoint });
    }

    try {
        return await connectCdp(endpoint);
    } catch (err) {
        throw new Error(
            `Chrome には届いていますが CDP 接続に失敗しました (${endpoint})\n` +
                `原因: ${(err as Error).message}\n\n` +
                '手動で起動し直す場合:\n  ' +
                manualCommand(Number(new URL(endpoint).port || 9222)),
        );
    }
}

/**
 * X にログインしているか確かめ、していなければその場でログインしてもらう。
 * 専用プロファイルを使うので初回は必ず未ログイン —— ここで案内しないと
 * 「0 件で終わった、なぜ」になる。
 */
export async function ensureLoggedIn(page: CdpPage): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
        await page.navigate('https://x.com/home');
        await sleep(2500);

        const url = await page.url().catch(() => '');
        if (/x\.com\/home/.test(url)) return;

        console.log(
            `\n  X にログインしていません。\n` +
                `  今開いている Chrome のウィンドウで X にログインしてください。\n` +
                `  (ログイン状態は ${PROFILE_DIR} に残るので、次回からは不要です)\n` +
                `\n  ログインし終えたら Enter を押してください...`,
        );
        await waitForEnter();
    }

    throw new Error('ログインが確認できませんでした。Chrome のウィンドウで X にログインしてから再実行してください。');
}

export interface CollectResult {
    query: string;
    captures: number;
    tweets: number;
    file: string;
}

async function collectQuery(
    conn: CdpConnection,
    page: CdpPage,
    query: string,
    runId: string,
    maxTweets: number,
): Promise<CollectResult> {
    const file = join(paths.raw, `${runId}-${slugify(query)}.jsonl`);
    const capture = attachCapture(conn, page, file, query);

    await page.navigate(`https://x.com/search?q=${encodeURIComponent(query)}&f=live`);
    await sleep(2500);

    const current = await page.url().catch(() => '');
    if (/\/login|\/i\/flow\/login/.test(current)) {
        await capture.detach();
        throw new Error('ログイン画面に飛ばされました。接続先の Chrome で X にログインしてから実行してください。');
    }

    if (collectConfig.autoScroll) {
        await autoScroll(page, capture, { label: query, maxTweets });
    } else {
        console.log('\n    autoScroll = false: ブラウザで手動スクロールしてください。終わったら Enter。');
        await waitForEnter();
    }

    await capture.detach();
    process.stdout.write(`\r    ${query} — ${capture.seenTweets.size} 件 (応答 ${capture.captures} 件)\n`);

    return { query, captures: capture.captures, tweets: capture.seenTweets.size, file };
}

export interface CollectOptions {
    autoLaunch?: boolean;
    /** 1 キーワードあたりの上限。小さくして試し撃ちするのに使う */
    maxTweets?: number;
}

export async function collectAll(
    queries = collectConfig.queries,
    { autoLaunch = true, maxTweets = collectConfig.maxTweetsPerQuery }: CollectOptions = {},
): Promise<CollectResult[]> {
    await mkdir(paths.raw, { recursive: true });

    const conn = await connect(autoLaunch);
    const page = await openPage(conn, collectConfig.viewport);
    const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const results: CollectResult[] = [];

    try {
        await ensureLoggedIn(page);

        for (const [i, query] of queries.entries()) {
            console.log(`  [${i + 1}/${queries.length}] ${query}`);
            results.push(await collectQuery(conn, page, query, runId, maxTweets));
            await sleep(randomDelay());
        }
    } finally {
        await page.close().catch(() => {});
        // 接続先はユーザー自身の Chrome なので、閉じるのは WebSocket だけ
        conn.close();
    }

    return results;
}
