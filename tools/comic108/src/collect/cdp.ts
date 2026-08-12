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

import { collect as collectConfig, event, paths } from '../../config';
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

/** X が応答ヘッダで返すレート制限の残り。15 分ごとに reset で回復する */
export interface RateLimit {
    limit: number;
    remaining: number;
    /** 回復する時刻(ミリ秒) */
    resetAt: number;
}

export interface Capture {
    readonly seenTweets: Set<string>;
    readonly captures: number;
    /** 直近の応答が持っていたレート制限の残り。分からなければ null */
    readonly rateLimit: RateLimit | null;
    /** HTTP エラーで返ってきた対象応答の数(429 のレート制限など) */
    readonly httpErrors: number;
    /** 本体が読めなかった対象応答の数 */
    readonly unreadable: number;
    /** 直近に見た HTTP エラーのステータス */
    readonly lastErrorStatus: number | null;
    /** 429 が返ってきた回数 */
    readonly rateLimitHits: number;
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
    let httpErrors = 0;
    let unreadable = 0;
    let lastErrorStatus: number | null = null;
    let rateLimitHits = 0;
    let rateLimit: RateLimit | null = null;

    const offResponse = conn.on('Network.responseReceived', (params, sid) => {
        if (sid !== page.sessionId) return;
        const response = (params.response ?? {}) as {
            url?: string;
            status?: number;
            headers?: Record<string, string>;
        };
        const url = String(response.url ?? '');
        if (!matchOperation(url)) return;

        /*
         * X は応答ヘッダに 15 分あたりの残り回数を書いてくる。
         * これを読んでおくと「急に何も出なくなった」のが枯れたのかレート制限なのかが分かるし、
         * いつ回復するかも書いてあるので、当てずっぽうで待たずに済む。
         */
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(response.headers ?? {})) headers[k.toLowerCase()] = String(v);
        const remaining = Number(headers['x-rate-limit-remaining']);
        const reset = Number(headers['x-rate-limit-reset']);
        if (Number.isFinite(remaining) && Number.isFinite(reset)) {
            rateLimit = { limit: Number(headers['x-rate-limit-limit']) || 0, remaining, resetAt: reset * 1000 };
        }

        // 対象の operation がエラーで返ってきたことは記録しておく。
        // 黙って捨てると「0 件」の理由がレート制限なのか本当に無いのか分からなくなる
        const status = Number(response.status ?? 0);
        if (status >= 400) {
            httpErrors++;
            lastErrorStatus = status;
            if (status === 429) rateLimitHits++;
            return;
        }
        watching.set(String(params.requestId), url);
    });

    // リクエスト自体が失敗した場合(中断・ネットワークエラー)も数える
    const offFailed = conn.on('Network.loadingFailed', (params, sid) => {
        if (sid !== page.sessionId) return;
        if (watching.delete(String(params.requestId))) unreadable++;
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
                // JSON でない / 既に破棄された応答
                unreadable++;
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
        get rateLimit() {
            return rateLimit;
        },
        get httpErrors() {
            return httpErrors;
        },
        get unreadable() {
            return unreadable;
        },
        get lastErrorStatus() {
            return lastErrorStatus;
        },
        get rateLimitHits() {
            return rateLimitHits;
        },
        async detach() {
            // 走査中の書き込みを取りこぼさないよう、落ち着くまで待つ
            for (let i = 0; i < 100 && pending > 0; i++) await sleep(100);
            offResponse();
            offFailed();
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
export async function autoScroll(
    page: CdpPage,
    capture: Capture,
    options: ScrollOptions = {},
): Promise<{ hitCap: boolean; rateLimited: boolean }> {
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
    let hitsWhenIdleBegan = capture.rateLimitHits;

    for (let round = 0; round < 2000; round++) {
        // 上限で止まったのか、本当に尽きたのかを呼び出し側に伝える。
        // 上限で止まったならその期間にはまだ奥がある
        if (capture.seenTweets.size >= maxTweets) return { hitCap: true, rateLimited: false };
        /*
         * 止まった理由が「尽きた」のか「レート制限で返ってこない」のかを分ける。
         *
         * 429 を見た瞬間に切ってはいけない —— ホバーカードなど、今スクロールしている
         * タイムラインとは関係のない要求が 429 になることがあり、それで打ち切ると
         * まだ読める途中で諦めてしまう。
         * 見るのは「新しいツイートが来なくなった間に 429 が増えたか」。増えていれば
         * タイムライン自体が返ってきていない = 採り終えていないので、引き直す必要がある。
         */
        if (idle >= collectConfig.idleRoundsBeforeStop) {
            return { hitCap: false, rateLimited: capture.rateLimitHits > hitsWhenIdleBegan };
        }

        const m = await page.evaluate<{ y: number; h: number; total: number }>(step);
        await sleep(delay());

        const grew = capture.seenTweets.size > lastCount;
        const moved = m.y > lastY + 8;
        const atBottom = m.y + m.h >= m.total - 400;

        if (grew) {
            idle = 0;
            hitsWhenIdleBegan = capture.rateLimitHits;
            lastCount = capture.seenTweets.size;
            if (label) process.stdout.write(`\r    ${label} — ${capture.seenTweets.size} 件`);
        } else if (atBottom || !moved) {
            idle++;
        } else {
            idle = 0; // まだ既読分を下っている途中
        }

        lastY = m.y;
    }
    return { hitCap: false, rateLimited: false };
}

// --- 期間で区切って掘る ---

export interface SearchWindow {
    /** since: に入れる日。この日を含む */
    from: string;
    /** この日の手前まで。until: には 1 日足したものを入れる */
    to: string;
}

const DAY_MS = 86400000;
const utc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** 窓の日数 */
export function windowDays(w: SearchWindow): number {
    return Math.round((utc(w.to) - utc(w.from)) / DAY_MS);
}

/** 期間を等間隔の窓に割る。新しいほうから先に見たいので、逆順で返す */
export function splitRange(from: string, to: string, days: number): SearchWindow[] {
    const out: SearchWindow[] = [];
    for (let t = utc(from); t < utc(to); t += days * DAY_MS) {
        out.push({ from: ymd(t), to: ymd(Math.min(t + days * DAY_MS, utc(to))) });
    }
    return out.reverse();
}

/** 上限に当たった窓を半分に割る。1 日まで来たらそれ以上は割れない */
export function halveWindow(w: SearchWindow): SearchWindow[] {
    const n = windowDays(w);
    if (n <= 1) return [];
    const mid = ymd(utc(w.from) + Math.floor(n / 2) * DAY_MS);
    // 新しいほうを先に
    return [
        { from: mid, to: w.to },
        { from: w.from, to: mid },
    ];
}

/**
 * 窓を検索式にする。
 * until: は指定日を含まないので 1 日足す。時差で境界の 1 日が漏れるのを防ぐぶんでもある
 * (重複したツイートは解析時に rest_id で潰れるので、余分なのは取得の手間だけ)。
 */
export function windowQuery(query: string, w: SearchWindow): string {
    return `${query} since:${w.from} until:${ymd(utc(w.to) + DAY_MS)}`;
}

/** 設定に from / to が無いときの既定。告知はイベント前の 1〜2 か月に集中する */
export function defaultRange(): { from: string; to: string } {
    const first = utc(event.days[0].date);
    const last = utc(event.days[event.days.length - 1].date);
    return { from: ymd(first - 45 * DAY_MS), to: ymd(last + 3 * DAY_MS) };
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
    /** この検索で初めて見たツイート数。窓を掘る価値があったかの目安 */
    newTweets: number;
    /** 上限まで採れて打ち切った = その期間にはまだ奥がある */
    hitCap: boolean;
    /** レート制限で打ち切った = 採り終えていないので引き直す必要がある */
    rateLimited: boolean;
    /** 直近に見たレート制限の残り */
    rateLimit: RateLimit | null;
    file: string;
    httpErrors: number;
    unreadable: number;
    lastErrorStatus: number | null;
}

async function collectQuery(
    conn: CdpConnection,
    page: CdpPage,
    query: string,
    runId: string,
    maxTweets: number,
    seenRun: Set<string> = new Set(),
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

    let hitCap = false;
    let rateLimited = false;
    if (collectConfig.autoScroll) {
        ({ hitCap, rateLimited } = await autoScroll(page, capture, { label: query, maxTweets }));
    } else {
        console.log('\n    autoScroll = false: ブラウザで手動スクロールしてください。終わったら Enter。');
        await waitForEnter();
    }

    await capture.detach();

    let newTweets = 0;
    for (const id of capture.seenTweets) if (!seenRun.has(id)) { seenRun.add(id); newTweets++; }

    const trouble =
        capture.httpErrors || capture.unreadable
            ? ` ⚠ HTTP エラー ${capture.httpErrors} 件${capture.lastErrorStatus ? `(直近 ${capture.lastErrorStatus})` : ''} / 読めず ${capture.unreadable} 件`
            : '';
    // 残り回数が見えていれば出す。「なぜ急に採れなくなったか」がその場で分かる
    const rl = capture.rateLimit;
    const budget = rl ? ` [残り ${rl.remaining}${rl.limit ? `/${rl.limit}` : ''}]` : '';
    process.stdout.write(
        `\r    ${query} — ${capture.seenTweets.size} 件` +
            `(新規 ${newTweets} / 応答 ${capture.captures})${budget}` +
            `${hitCap ? ' ⤵ 上限' : ''}${rateLimited ? ' ⏳ レート制限' : ''}${trouble}\n`,
    );

    return {
        query,
        captures: capture.captures,
        tweets: capture.seenTweets.size,
        newTweets,
        hitCap,
        rateLimited,
        rateLimit: capture.rateLimit,
        file,
        httpErrors: capture.httpErrors,
        unreadable: capture.unreadable,
        lastErrorStatus: capture.lastErrorStatus,
    };
}

export interface CollectOptions {
    autoLaunch?: boolean;
    /** 1 回の検索の上限。小さくして試し撃ちするのに使う */
    maxTweets?: number;
    /** 期間で切って掘るか。false ならキーワードごとに 1 回だけ検索する */
    useWindows?: boolean;
    /** 探す期間。省略すると config か既定の範囲 */
    from?: string;
    to?: string;
}

/**
 * レート制限に当たったときの待ち時間。
 * X の窓は 15 分なので、応答ヘッダの reset が読めなければこれだけ待つ。
 */
const RATE_LIMIT_WAIT_MS = 15 * 60_000;
/** reset が壊れた値でも延々待たないための上限 */
const RATE_LIMIT_MAX_WAIT_MS = 20 * 60_000;
/** 同じ期間をレート制限で引き直す回数の上限 */
const RATE_LIMIT_RETRIES = 3;

/** 次にレート制限が回復するまでの待ち時間 */
function waitForReset(r: CollectResult): number {
    if (!r.rateLimit) return RATE_LIMIT_WAIT_MS;
    const until = r.rateLimit.resetAt - Date.now() + 5_000; // 少し余裕を足す
    return Math.min(RATE_LIMIT_MAX_WAIT_MS, Math.max(30_000, until));
}

export async function collectAll(
    queries = collectConfig.queries,
    {
        autoLaunch = true,
        maxTweets = collectConfig.maxTweetsPerQuery,
        useWindows = collectConfig.window.enabled,
        from,
        to,
    }: CollectOptions = {},
): Promise<CollectResult[]> {
    await mkdir(paths.raw, { recursive: true });

    const range = { ...defaultRange() };
    if (collectConfig.window.from) range.from = collectConfig.window.from;
    if (collectConfig.window.to) range.to = collectConfig.window.to;
    if (from) range.from = from;
    if (to) range.to = to;

    const conn = await connect(autoLaunch);
    const page = await openPage(conn, collectConfig.viewport);
    const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const results: CollectResult[] = [];
    // 走査全体で見たツイート。同じ投稿が別の窓・別のキーワードで何度も出てくる
    const seenRun = new Set<string>();

    try {
        await ensureLoggedIn(page);

        for (const [i, query] of queries.entries()) {
            // 窓は新しいほうから。直前の告知がいちばん濃い
            const queue: (SearchWindow | null)[] = useWindows
                ? splitRange(range.from, range.to, collectConfig.window.initialDays)
                : [null];
            const planned = queue.length;
            const retries = new Map<string, number>();
            let done = 0;

            console.log(
                `  [${i + 1}/${queries.length}] ${query}` +
                    (useWindows ? ` — ${range.from}〜${range.to} を ${planned} 期間から` : ''),
            );

            while (queue.length && done < collectConfig.window.maxWindowsPerQuery) {
                const w = queue.shift() ?? null;
                const q = w ? windowQuery(query, w) : query;
                const r = await collectQuery(conn, page, q, runId, maxTweets, seenRun);
                results.push(r);
                done++;

                // 上限まで採れた窓は、まだ奥に残っているということ。半分に割って掘り直す。
                // 尽きた窓はそれ以上触らない —— 実りの無い期間に時間をかけない
                if (w && r.hitCap) {
                    const halves = halveWindow(w);
                    if (halves.length) {
                        queue.unshift(...halves);
                        console.log(`    ↳ まだ奥がありそうなので ${w.from}〜${w.to} を 2 つに割ります`);
                    }
                }

                /*
                 * レート制限で切れた期間は採り終えていない。回復を待って同じ期間を引き直す。
                 * ここで次へ進んでしまうと、その期間だけ穴が空いたまま「完了」になる。
                 */
                if (r.rateLimited || r.lastErrorStatus === 429) {
                    const key = w ? `${w.from}/${w.to}` : query;
                    const tried = (retries.get(key) ?? 0) + 1;
                    retries.set(key, tried);
                    const wait = waitForReset(r);
                    console.log(
                        `    レート制限。${Math.round(wait / 60_000)} 分ほど待ちます` +
                            (tried <= RATE_LIMIT_RETRIES ? `(この期間を引き直します ${tried}/${RATE_LIMIT_RETRIES})` : ''),
                    );
                    await sleep(wait);
                    if (tried <= RATE_LIMIT_RETRIES) {
                        queue.unshift(w);
                        done--; // 引き直しは進捗に数えない
                        continue;
                    }
                    console.log('    引き直しても抜けられないので、この期間は諦めて次に進みます');
                }
                await sleep(randomDelay());
            }

            if (done >= collectConfig.window.maxWindowsPerQuery) {
                console.log(`    上限 ${collectConfig.window.maxWindowsPerQuery} 期間に達したので次のキーワードへ`);
            }
        }
    } finally {
        await page.close().catch(() => {});
        // 接続先はユーザー自身の Chrome なので、閉じるのは WebSocket だけ
        conn.close();
    }

    return results;
}
