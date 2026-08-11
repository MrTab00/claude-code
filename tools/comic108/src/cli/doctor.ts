/**
 * 実行前の環境チェック。採集で詰まる原因を先に潰す。
 *   bun run doctor
 */

import { existsSync } from 'node:fs';

import { collect as collectConfig, paths } from '../../config';
import { connectCdp, openPage } from '../collect/cdp-client';
import { PROFILE_DIR, endpointAlive, findChrome, manualCommand } from '../collect/launch';

const ok = (m: string) => console.log(`  ✓ ${m}`);
const warn = (m: string) => console.log(`  ! ${m}`);
const bad = (m: string) => console.log(`  ✗ ${m}`);

console.log('\n環境チェック\n');

// --- Bun ---
ok(`Bun ${Bun.version}`);

// --- Chrome ---
const chrome = findChrome();
if (chrome) ok(`Chrome: ${chrome}`);
else bad('Chrome が見つかりません。CHROME_PATH で指定できます');

// --- プロファイル ---
if (existsSync(PROFILE_DIR)) ok(`専用プロファイルあり: ${PROFILE_DIR}`);
else warn(`専用プロファイル未作成 (初回の collect で作られます): ${PROFILE_DIR}`);

// --- CDP エンドポイント ---
const alive = await endpointAlive(collectConfig.cdpEndpoint);
if (alive) {
    ok(`DevTools エンドポイント応答あり: ${collectConfig.cdpEndpoint}`);

    try {
        const conn = await connectCdp(collectConfig.cdpEndpoint);
        ok('CDP 接続できました');

        const page = await openPage(conn);
        await page.navigate('https://x.com/home');
        await new Promise((r) => setTimeout(r, 2500));
        const url = await page.url().catch(() => '');

        if (/x\.com\/home/.test(url)) ok('X にログイン済み');
        else warn(`X 未ログイン (現在地: ${url || '不明'}) — collect 実行時にログインを求めます`);

        await page.close();
        conn.close();
    } catch (err) {
        bad(`CDP 接続に失敗: ${(err as Error).message}`);
    }
} else {
    warn(`DevTools エンドポイント未応答: ${collectConfig.cdpEndpoint}`);
    console.log(`      collect 実行時に自動起動します。手動なら:\n      ${manualCommand(9222)}`);
}

// --- 出力先 ---
ok(`出力先: ${paths.raw}`);
if (existsSync(paths.overrides)) ok('overrides.json あり');

console.log(`
準備ができたら:
  bun run collect   採集
  bun run parse     解析
  bun run build     HTML 生成
`);
