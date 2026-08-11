/**
 * 采集层的端到端自测。不碰 x.com, 也不需要账号。
 *
 * 做法: 本地起一个假页面, 它像 X 的前端那样在滚动时请求 /i/api/graphql/<hash>/SearchTimeline,
 * 返回 fixture 响应。然后按用户的真实路径 —— 带 --remote-debugging-port 启动一个 Chrome,
 * 从外部 connectCdp 连上去, attachCapture 挂监听, 滚动 —— 验证响应确实被捕获并落盘。
 *
 * 这样能验证除「x.com 页面结构」以外的全部采集逻辑。
 *   bun run test:collect
 *
 * 需要一个 Chrome/Chromium。CHROME_PATH で明示できる。見つからなければスキップする。
 */

import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { RawCapture } from '../types';
import { attachCapture, autoScroll, matchOperation } from './cdp';
import { connectCdp, openPage } from './cdp-client';

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    '/opt/pw-browsers/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean) as string[];

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));

const failures: string[] = [];
let checks = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
    checks++;
    if (!cond) failures.push(`${name}${detail === undefined ? '' : `\n    ${JSON.stringify(detail)}`}`);
};

// --- operation 判定は Chrome 不要 ---
check('SearchTimeline を拾う', matchOperation('https://x.com/i/api/graphql/AbC123/SearchTimeline?v=1') === 'SearchTimeline');
check('UserTweets を拾う', matchOperation('https://x.com/i/api/graphql/XyZ/UserTweets') === 'UserTweets');
check('対象外の operation は拾わない', matchOperation('https://x.com/i/api/graphql/XyZ/AudioSpaceById') === null);
check('GraphQL 以外は拾わない', matchOperation('https://x.com/i/api/2/notifications/all.json') === null);
check('doc_id が変わっても名前で拾える', matchOperation('https://x.com/i/api/graphql/totally-different-hash/SearchTimeline') === 'SearchTimeline');

if (!chromePath) {
    console.log('\nChrome が見つからないため、ブラウザを使う部分はスキップしました。');
    console.log('CHROME_PATH=/path/to/chrome bun run test:collect で実行できます。');
    console.log(`\n採集テスト: ${checks - failures.length}/${checks} passed\n`);
    if (failures.length) {
        for (const f of failures) console.error(`  ✗ ${f}\n`);
        process.exit(1);
    }
    process.exit(0);
}

const DEBUG_PORT = 9333;
const fixture = JSON.parse(await readFile(join(import.meta.dir, '../fixtures/search-timeline.json'), 'utf8'));

// --- 假的 X 前端 ---
let pageRequests = 0;
const server = Bun.serve({
    port: 0,
    fetch(req) {
        const { pathname } = new URL(req.url);

        if (pathname.endsWith('/SearchTimeline')) {
            pageRequests++;
            return Response.json(fixture);
        }
        // 監視対象外の operation —— 捕獲されてはいけない
        if (pathname.endsWith('/AudioSpaceById')) return Response.json({ data: { ignored: true } });
        // GraphQL ではない API —— 捕獲されてはいけない
        if (pathname.startsWith('/i/api/2/')) return Response.json({ notGraphql: true });

        // 本物のタイムラインと同じく「下端に近づいた時だけ」次を読む無限スクロール。
        // 毎スクロールで無条件に読み込む作りにすると、下端まで到達しないまま
        // 諦めてしまうバグを取り逃がす。
        return new Response(
            `<!doctype html><meta charset="utf-8"><title>fake x</title>
             <div id="feed" style="height:6000px">scroll me</div>
             <script>
               const feed = document.getElementById('feed');
               let loading = false, pages = 0;
               const hit = () => {
                 fetch('/i/api/graphql/AbC123hash/SearchTimeline?variables=%7B%7D');
                 fetch('/i/api/graphql/XyZ789hash/AudioSpaceById');
                 fetch('/i/api/2/notifications/all.json');
               };
               hit();
               addEventListener('scroll', () => {
                 if (loading || pages >= 4) return;
                 const nearBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 400;
                 if (!nearBottom) return;
                 loading = true;
                 setTimeout(() => { pages++; feed.style.height = (6000 * (pages + 1)) + 'px'; hit(); loading = false; }, 150);
               });
             </script>`,
            { headers: { 'content-type': 'text/html' } },
        );
    },
});

const workDir = await mkdtemp(join(tmpdir(), 'c108-collect-'));
const userDataDir = await mkdtemp(join(tmpdir(), 'c108-chrome-'));
const file = join(workDir, 'capture.jsonl');

// ユーザーの手順と同じ: --remote-debugging-port 付きで起動しておいた Chrome に、後から外部接続する
const chrome = Bun.spawn(
    [
        chromePath,
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--user-data-dir=${userDataDir}`,
        '--headless=new',
        '--no-sandbox',
        '--no-first-run',
        'about:blank',
    ],
    { stdout: 'ignore', stderr: 'ignore' },
);

for (let i = 0; i < 80; i++) {
    try {
        if ((await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).ok) break;
    } catch {
        /* まだ起動中 */
    }
    await new Promise((r) => setTimeout(r, 250));
}

try {
    const conn = await connectCdp(`http://127.0.0.1:${DEBUG_PORT}`);
    check('起動済み Chrome に CDP で接続できる', true);

    const page = await openPage(conn);
    check('新しいタブを開ける', !!page.sessionId && !!page.targetId);

    const capture = attachCapture(conn, page, file, 'テストクエリ');
    await page.navigate(`http://127.0.0.1:${server.port}/`);

    // 本番と同じ autoScroll を使う。手でスクロールして通してしまうと、
    // 「下端に着く前に諦める」バグを見逃す
    await autoScroll(page, capture, { maxTweets: 9999, delay: () => 120 });
    await new Promise((r) => setTimeout(r, 600));
    await capture.detach();

    check('location.href を読める', (await page.url()).includes(`:${server.port}`));
    check('SearchTimeline の応答を捕獲した', capture.captures >= 2, capture.captures);
    // 下端まで下りきって次ページを引き出せているか —— 1 ページ目で止まっていないこと
    check('無限スクロールを最後まで辿れている', capture.captures >= 4, capture.captures);
    check('ページが実際に複数回リクエストしている', pageRequests >= 4, pageRequests);
    check('ツイート id を数えている(リツイート含む 6 件)', capture.seenTweets.size === 6, [...capture.seenTweets]);
    check('jsonl が書かれている', existsSync(file));

    const lines = (await readFile(file, 'utf8')).trim().split('\n');
    check('行数 = 捕獲数', lines.length === capture.captures, { lines: lines.length, captures: capture.captures });

    const rows = lines.map((l) => JSON.parse(l) as RawCapture);
    check('op 名が記録されている', rows.every((r) => r.op === 'SearchTimeline'), rows.map((r) => r.op));
    check('対象外 operation は捕獲していない', !rows.some((r) => r.op === 'AudioSpaceById'));
    check('GraphQL 以外は捕獲していない', !rows.some((r) => r.url.includes('/i/api/2/')));
    check('query が記録されている', rows.every((r) => r.query === 'テストクエリ'));
    check('応答本体がそのまま保存されている', !!(rows[0]?.body as { data?: unknown })?.data);

    await page.close();
    conn.close();

    // --- 自動起動の経路 ---
    // 手で長いコマンドを打たせないための仕組みなので、探索→起動→接続まで通しで確かめる
    const { launchChrome, findChrome, endpointAlive } = await import('./launch');
    check('Chrome を自動検出できる', !!findChrome(), findChrome());
    check('未起動のエンドポイントは死んでいると判定する', !(await endpointAlive('http://127.0.0.1:9399')));

    const launched = await launchChrome({ endpoint: 'http://127.0.0.1:9334', headless: true, timeoutMs: 40000 });
    check('自動起動できる', !!launched, launched);
    check('起動後はエンドポイントが応答する', await endpointAlive('http://127.0.0.1:9334'));

    const conn2 = await connectCdp('http://127.0.0.1:9334');
    const page2 = await openPage(conn2);
    await page2.navigate(`http://127.0.0.1:${server.port}/`);
    check('自動起動した Chrome でページを開ける', (await page2.url()).includes(`:${server.port}`));
    await page2.close();
    conn2.close();
} finally {
    chrome.kill();
    await chrome.exited.catch(() => {});
    server.stop(true);
    await rm(workDir, { recursive: true, force: true });
    await rm(userDataDir, { recursive: true, force: true });
}

console.log(`\n採集テスト: ${checks - failures.length}/${checks} passed\n`);
if (failures.length) {
    for (const f of failures) console.error(`  ✗ ${f}\n`);
    process.exit(1);
}
console.log('  ✓ 全部通过\n');
