/**
 * 「隠しているつもりの物が本当に隠れているか」を実際の描画で確かめる。
 *
 * hidden 属性はブラウザ既定の [hidden]{display:none} で効くが、これは特異性が最弱で
 * #panel{display:flex} のような指定に負ける。実際それで詳細パネルが出っぱなしになった。
 * el.hidden を読むテストでは attribute しか見えず、この不具合を素通りさせてしまうので、
 * ここでは getComputedStyle と実寸で判定する。
 *   bun run test:visibility
 */

import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { connectCdp, openPage } from '../collect/cdp-client';
import { findChrome } from '../collect/launch';

const failures: string[] = [];
let checks = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
    checks++;
    if (!cond) failures.push(`${name}${detail === undefined ? '' : `\n    ${JSON.stringify(detail)}`}`);
};

const chrome = findChrome();
const demo = join(import.meta.dir, '../../dist/c108-demo.html');

if (!chrome || !existsSync(demo)) {
    console.log(`\n${chrome ? 'dist/c108-demo.html が無い(bun run demo)' : 'Chrome が見つからない'}ためスキップしました。`);
    process.exit(0);
}

const PORT = 9371;
const profile = await mkdtemp(join(tmpdir(), 'c108-vis-'));
const proc = Bun.spawn(
    [chrome, `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--headless=new',
     ...(process.env.C108_CHROME_ARGS ?? '').split(' ').filter(Boolean), '--no-first-run', 'about:blank'],
    { stdout: 'ignore', stderr: 'ignore' },
);
for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch { /* 起動待ち */ }
    await new Promise((r) => setTimeout(r, 250));
}

try {
    const conn = await connectCdp(`http://127.0.0.1:${PORT}`);
    const page = await openPage(conn, { width: 1280, height: 1000 });
    await page.navigate(`file://${demo}`);
    await new Promise((r) => setTimeout(r, 600));

    /** 属性ではなく、実際に描画されているかで判定する */
    const shown = (sel: string) =>
        page.evaluate<boolean>(`(() => {
            const el = document.querySelector('${sel}');
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0;
        })()`);

    // 既定は地図。一覧を読むより先に「どこにいるか」が見えるべき
    check('最初に地図が出ている', await shown('#mapwrap'));
    check('地図の島が描かれている', (await page.evaluate<number>('document.querySelectorAll(".island").length')) === 115);
    check('初期状態で詳細パネルは出ていない', !(await shown('#panel')));
    check('初期状態で背景の覆いは出ていない', !(await shown('#backdrop')));
    check('初期状態でカードは出ていない(地図が主役)', !(await shown('#grid')));

    // 地図のスペースを押すとそのサークルのパネルが開く —— 地図が主役なので、ここが基本の導線
    check('地図にスペースが描かれている', (await page.evaluate<number>('document.querySelectorAll(".sp").length')) > 0);
    await page.evaluate(`document.querySelector('.sp').click()`);
    await new Promise((r) => setTimeout(r, 300));
    check('スペースを押すとパネルが開く', await shown('#panel'));
    check('同時に背景も出る', await shown('#backdrop'));

    await page.evaluate(`document.querySelector('#panel .close').click()`);
    await new Promise((r) => setTimeout(r, 250));
    check('閉じるとパネルが消える', !(await shown('#panel')));
    check('背景も消える', !(await shown('#backdrop')));

    // 縮小したら字を消す。読めない字を並べても仕方ないし描画も重い
    await page.evaluate('applyZoom(0.5)');
    await new Promise((r) => setTimeout(r, 200));
    check('縮小時は文字を出さない', (await page.evaluate<string>('document.getElementById("mapcanvas").dataset.detail')) === '0');
    await page.evaluate('applyZoom(1.6)');
    await new Promise((r) => setTimeout(r, 200));
    check('拡大時はサークル名を出す', (await page.evaluate<string>('document.getElementById("mapcanvas").dataset.detail')) === '2');

    await page.evaluate(`document.querySelector('.viewpick .chip[data-view="table"]').click()`);
    await new Promise((r) => setTimeout(r, 250));
    check('表ビューで表が出る', await shown('#ltable-wrap'));
    check('表ビューでは地図を出さない', !(await shown('#mapwrap')));
    check('表ビューでカードは出ない', !(await shown('#grid')));

    await page.evaluate(`document.querySelector('.viewpick .chip[data-view="cards"]').click()`);
    await new Promise((r) => setTimeout(r, 250));
    check('カードビューでカードが出る', await shown('#grid'));
    check('カードビューでは表を出さない', !(await shown('#ltable-wrap')));

    await page.evaluate(`document.querySelector('.card .who').click()`);
    await new Promise((r) => setTimeout(r, 300));
    check('カードからもパネルが開く', await shown('#panel'));
    await page.evaluate(`document.querySelector('#panel .close').click()`);
    await new Promise((r) => setTimeout(r, 250));

    await page.evaluate(`document.querySelector('.tab[data-tab="cosplayers"]').click()`);
    await new Promise((r) => setTimeout(r, 250));
    check('コスプレタブで地図が消える', !(await shown('#mapwrap')));
    check('コスプレタブで地区チップが消える', !(await shown('#area-filter')));

    await page.close();
    conn.close();
} finally {
    proc.kill();
    await proc.exited.catch(() => {});
    await rm(profile, { recursive: true, force: true });
}

console.log(`\n表示テスト: ${checks - failures.length}/${checks} passed\n`);
if (failures.length) {
    for (const f of failures) console.error(`  ✗ ${f}\n`);
    process.exit(1);
}
console.log('  ✓ 全部通过\n');
