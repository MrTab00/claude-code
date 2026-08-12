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
import { attachCapture, autoScroll, clampToToday, defaultRange, halveWindow, matchOperation, splitRange, windowDays, windowQuery } from './cdp';
import { companyBooths, companyHallOf } from '../render/venue';
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
    // --- 上限で止まったのか、本当に尽きたのか(ブラウザ不要) ---
// ここを取り違えると、まだ奥が残っている期間を「終わった」と判断して掘るのをやめてしまう。
{
    const bottom = { evaluate: async () => ({ y: 0, h: 100, total: 100 }) } as never;
    const full = { seenTweets: new Set(['a', 'b', 'c']) } as never;
    const empty = { seenTweets: new Set<string>() } as never;

    check('上限まで採れたら hitCap', (await autoScroll(bottom, full, { maxTweets: 3, delay: () => 0 })).hitCap === true);
    check('尽きたときは hitCap を立てない',
        (await autoScroll(bottom, empty, { maxTweets: 999, delay: () => 0 })).hitCap === false);

    // レート制限で切れた期間を「尽きた」と扱うと、その期間だけ穴が空いたまま完了になる。
    // 判断材料は「新しいツイートが来なくなった間に 429 が増えたか」
    let hits = 0;
    const limited = { seenTweets: new Set<string>(), get rateLimitHits() { return ++hits; } } as never;
    const r = await autoScroll(bottom, limited, { maxTweets: 999, delay: () => 0 });
    check('止まった間に 429 が増えていればレート制限と見なす', r.rateLimited === true && r.hitCap === false, r);

    const quiet = { seenTweets: new Set<string>(), rateLimitHits: 7 } as never;
    const r2 = await autoScroll(bottom, quiet, { maxTweets: 999, delay: () => 0 });
    check('前に見た 429 が残っているだけなら尽きたと見なす', r2.rateLimited === false, r2);
}

// --- 期間で区切って掘るときの窓の計算(ブラウザ不要) ---
// X の検索は 1 回でどこまで遡れるかに上限がある。期間を切って引き直すのが取りこぼし対策だが、
// 窓に隙間や重なりがあると、まるごと 1 日ぶん落としたり同じ範囲を何度も引いたりする。
{
    const ws = splitRange('2026-07-01', '2026-08-19', 14);
    check('期間を窓に割る', ws.length === 4, ws);
    check('新しい期間から先に見る', ws[0].from === '2026-08-12', ws[0]);
    check('窓に隙間も重なりも無い', ws.every((w, i) => i === 0 || ws[i - 1].from === w.to), ws);
    check('端数の窓は短くなる', windowDays(ws[0]) === 7 && windowDays(ws[1]) === 14, ws.map(windowDays));
    check('合計が指定した期間と一致', ws.reduce((n, w) => n + windowDays(w), 0) === 49, ws.map(windowDays));

    // until: は指定日を含まない。1 日足しておかないと窓の最終日が毎回落ちる
    check('until は 1 日先を指す', windowQuery('#C108', ws[0]) === '#C108 since:2026-08-12 until:2026-08-20',
        windowQuery('#C108', ws[0]));

    const halves = halveWindow(ws[1]);
    check('上限に当たった窓は半分になる', halves.length === 2 && windowDays(halves[0]) === 7, halves);
    check('割った窓も新しいほうが先', halves[0].from === '2026-08-05', halves);
    check('割った窓を足すと元に戻る', halves[1].from === ws[1].from && halves[0].to === ws[1].to, halves);
    check('1 日まで来たらそれ以上割らない', halveWindow({ from: '2026-08-01', to: '2026-08-02' }).length === 0);

    // 未来を検索しても必ず 0 件。イベント前に走らせると範囲の後ろが丸ごと空振りになる
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const range = defaultRange();
    check('既定の範囲はイベント前から始まる', range.from < '2026-08-15', range);
    check('既定の範囲は未来まで伸びない', range.to <= tomorrow, { range, tomorrow });
    check('明日までに切り詰める', clampToToday('2099-01-01') === tomorrow, clampToToday('2099-01-01'));
    check('過去の指定はそのまま', clampToToday('2020-01-01') === '2020-01-01');
}

// --- 企業ブースの構成表 ---
// 企業ブースパンフレット(2026 SUMMER)の地図から起こした。社数が合っていれば拾い漏らしは無い
{
    const all = companyBooths();
    check('企業ブースは 122 社', all.length === 122, all.length);
    check('番号の重複が無い', new Set(all).size === all.length);
    check('1xxx は西 / 2xxx は南',
        all.every((n) => (String(n).length === 4 ? companyHallOf(n)?.area === (String(n)[0] === '1' ? '西' : '南') : true)));
    check('ガールズエリアは南3', [111, 112, 121, 122, 911, 912, 913, 914]
        .every((n) => companyHallOf(n)?.area === '南' && companyHallOf(n)?.hall === '3'));
    check('14xx は西4', companyHallOf(1411)?.hall === '4' && companyHallOf(1451)?.hall === '4');
    check('19xx は西3', companyHallOf(1911)?.hall === '3' && companyHallOf(1943)?.hall === '3');
    check('24xx〜26xx は南4', [2411, 2511, 2641].every((n) => companyHallOf(n)?.hall === '4'));
    check('構成表に無い番号は null', companyHallOf(9999) === null && companyHallOf(2026) === null);
}

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
        // レート制限された対象 operation。黙って捨てず、数えられなければならない
        if (pathname.endsWith('/UserTweets')) return new Response('Rate limit exceeded', { status: 429 });
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
                 fetch('/i/api/graphql/Rate999hash/UserTweets').catch(() => {});
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

    const page = await openPage(conn, { width: 1440, height: 3200 });
    check('新しいタブを開ける', !!page.sessionId && !!page.targetId);

    await page.navigate(`http://127.0.0.1:${server.port}/`);
    // 視口を高く取れているか。ここが実ウィンドウ相当のままだと走査が桁違いに遅くなる
    check('視口の高さを上書きできている', (await page.evaluate<number>('window.innerHeight')) === 3200, await page.evaluate('window.innerHeight'));

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

    // 「0 件」の理由がレート制限なのか、本当に該当が無いのかを区別できること
    check('HTTP エラーを数えている', capture.httpErrors > 0, capture.httpErrors);
    check('直近のステータスが 429', capture.lastErrorStatus === 429, capture.lastErrorStatus);
    check('エラー応答は jsonl に混ざらない', !rows.some((r) => r.op === 'UserTweets'), rows.map((r) => r.op));

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

// --- 上限で止まったのか、本当に尽きたのか(ブラウザ不要) ---
// ここを取り違えると、まだ奥が残っている期間を「終わった」と判断して掘るのをやめてしまう。
{
    const bottom = { evaluate: async () => ({ y: 0, h: 100, total: 100 }) } as never;
    const full = { seenTweets: new Set(['a', 'b', 'c']) } as never;
    const empty = { seenTweets: new Set<string>() } as never;

    check('上限まで採れたら hitCap', (await autoScroll(bottom, full, { maxTweets: 3, delay: () => 0 })).hitCap === true);
    check('尽きたときは hitCap を立てない',
        (await autoScroll(bottom, empty, { maxTweets: 999, delay: () => 0 })).hitCap === false);

    // レート制限で切れた期間を「尽きた」と扱うと、その期間だけ穴が空いたまま完了になる。
    // 判断材料は「新しいツイートが来なくなった間に 429 が増えたか」
    let hits = 0;
    const limited = { seenTweets: new Set<string>(), get rateLimitHits() { return ++hits; } } as never;
    const r = await autoScroll(bottom, limited, { maxTweets: 999, delay: () => 0 });
    check('止まった間に 429 が増えていればレート制限と見なす', r.rateLimited === true && r.hitCap === false, r);

    const quiet = { seenTweets: new Set<string>(), rateLimitHits: 7 } as never;
    const r2 = await autoScroll(bottom, quiet, { maxTweets: 999, delay: () => 0 });
    check('前に見た 429 が残っているだけなら尽きたと見なす', r2.rateLimited === false, r2);
}

// --- 期間で区切って掘るときの窓の計算(ブラウザ不要) ---
// X の検索は 1 回でどこまで遡れるかに上限がある。期間を切って引き直すのが取りこぼし対策だが、
// 窓に隙間や重なりがあると、まるごと 1 日ぶん落としたり同じ範囲を何度も引いたりする。
{
    const ws = splitRange('2026-07-01', '2026-08-19', 14);
    check('期間を窓に割る', ws.length === 4, ws);
    check('新しい期間から先に見る', ws[0].from === '2026-08-12', ws[0]);
    check('窓に隙間も重なりも無い', ws.every((w, i) => i === 0 || ws[i - 1].from === w.to), ws);
    check('端数の窓は短くなる', windowDays(ws[0]) === 7 && windowDays(ws[1]) === 14, ws.map(windowDays));
    check('合計が指定した期間と一致', ws.reduce((n, w) => n + windowDays(w), 0) === 49, ws.map(windowDays));

    // until: は指定日を含まない。1 日足しておかないと窓の最終日が毎回落ちる
    check('until は 1 日先を指す', windowQuery('#C108', ws[0]) === '#C108 since:2026-08-12 until:2026-08-20',
        windowQuery('#C108', ws[0]));

    const halves = halveWindow(ws[1]);
    check('上限に当たった窓は半分になる', halves.length === 2 && windowDays(halves[0]) === 7, halves);
    check('割った窓も新しいほうが先', halves[0].from === '2026-08-05', halves);
    check('割った窓を足すと元に戻る', halves[1].from === ws[1].from && halves[0].to === ws[1].to, halves);
    check('1 日まで来たらそれ以上割らない', halveWindow({ from: '2026-08-01', to: '2026-08-02' }).length === 0);

    // 未来を検索しても必ず 0 件。イベント前に走らせると範囲の後ろが丸ごと空振りになる
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const range = defaultRange();
    check('既定の範囲はイベント前から始まる', range.from < '2026-08-15', range);
    check('既定の範囲は未来まで伸びない', range.to <= tomorrow, { range, tomorrow });
    check('明日までに切り詰める', clampToToday('2099-01-01') === tomorrow, clampToToday('2099-01-01'));
    check('過去の指定はそのまま', clampToToday('2020-01-01') === '2020-01-01');
}

// --- 企業ブースの構成表 ---
// 企業ブースパンフレット(2026 SUMMER)の地図から起こした。社数が合っていれば拾い漏らしは無い
{
    const all = companyBooths();
    check('企業ブースは 122 社', all.length === 122, all.length);
    check('番号の重複が無い', new Set(all).size === all.length);
    check('1xxx は西 / 2xxx は南',
        all.every((n) => (String(n).length === 4 ? companyHallOf(n)?.area === (String(n)[0] === '1' ? '西' : '南') : true)));
    check('ガールズエリアは南3', [111, 112, 121, 122, 911, 912, 913, 914]
        .every((n) => companyHallOf(n)?.area === '南' && companyHallOf(n)?.hall === '3'));
    check('14xx は西4', companyHallOf(1411)?.hall === '4' && companyHallOf(1451)?.hall === '4');
    check('19xx は西3', companyHallOf(1911)?.hall === '3' && companyHallOf(1943)?.hall === '3');
    check('24xx〜26xx は南4', [2411, 2511, 2641].every((n) => companyHallOf(n)?.hall === '4'));
    check('構成表に無い番号は null', companyHallOf(9999) === null && companyHallOf(2026) === null);
}

console.log(`\n採集テスト: ${checks - failures.length}/${checks} passed\n`);
if (failures.length) {
    for (const f of failures) console.error(`  ✗ ${f}\n`);
    process.exit(1);
}
console.log('  ✓ 全部通过\n');
