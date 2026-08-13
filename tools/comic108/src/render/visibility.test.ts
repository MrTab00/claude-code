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

    // 既定は地図タブ。一覧を読むより先に「どこにいるか」が見えるべき
    check('最初に地図が出ている', await shown('#mapwrap'));
    check('地図タブが選ばれている', (await page.evaluate<string>('state.tab')) === 'map');
    // 縮小しても中身の大きさに合わせてスクロール範囲が縮むこと(下に空白が伸びない)
    check('スクロール範囲が見た目に追随する', await page.evaluate<boolean>(`(() => {
        const sizer = document.getElementById('mapsizer').getBoundingClientRect();
        const canvas = document.getElementById('mapcanvas').getBoundingClientRect();
        return Math.abs(sizer.height - canvas.height) < 4 && Math.abs(sizer.width - canvas.width) < 4;
    })()`));
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

    /*
     * プラン: 印を付けたサークルだけを、当日まわる順(日 → 地区 → 配置)に並べる。
     * 地図も同じ絞り込みで描くので、印を付けたマスだけが残る = それが強調表示になる。
     */
    await page.evaluate(`document.querySelector('.tab[data-tab="plan"]').click()`);
    await new Promise((r) => setTimeout(r, 300));
    check('印が無いうちは空の案内を出す', await shown('#planwrap'));
    check('印が無ければ行は無い', (await page.evaluate<number>('document.querySelectorAll(".prow").length')) === 0);

    await page.evaluate(`(() => {
        const withBooth = groupByAccount(DATA.circles).filter(e => (e.booths || []).some(b => official(b)));
        store.marks[withBooth[0].screenName] = { s: 'must' };
        if (withBooth[1]) store.marks[withBooth[1].screenName] = { s: 'like' };
        store.marks[withBooth[withBooth.length - 1].screenName] = { s: 'skip' };
        saveStore();
        render();
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    const planned = await page.evaluate<number>('document.querySelectorAll(".prow").length');
    check('★と♡だけが並ぶ(⊖見送りは入れない)', planned === 2, planned);
    check('タブの数字が一致する', (await page.evaluate<string>('document.getElementById("plan-n").textContent')) === '2');
    // 地図に残るマスが印の数と一致していれば、それが強調表示になっている
    check('地図には印を付けたマスだけが残る',
        (await page.evaluate<number>('document.querySelectorAll("#mapcanvas .sp").length')) === 2);
    check('プランでも地図は出したまま', await shown('#mapwrap'));

    await page.evaluate(`document.querySelector('.prow').click()`);
    await new Promise((r) => setTimeout(r, 300));
    check('プランの行を押すと詳細が開く', await shown('#panel'));
    await page.evaluate(`document.querySelector('#panel .close').click()`);
    await new Promise((r) => setTimeout(r, 200));

    // 一覧はタブを移ってから
    await page.evaluate(`document.querySelector('.tab[data-tab="circles"]').click()`);
    await new Promise((r) => setTimeout(r, 250));
    check('サークルタブで地図が消える', !(await shown('#mapwrap')));

    await page.evaluate(`document.querySelector('.viewpick .chip[data-view="table"]').click()`);
    await new Promise((r) => setTimeout(r, 250));
    check('表ビューで表が出る', await shown('#ltable-wrap'));
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

    // 狭い画面では絞り込みを畳んで、まず地図を見せる
    await conn.send('Emulation.setDeviceMetricsOverride',
        { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, page.sessionId);
    await page.evaluate(`document.querySelector('.tab[data-tab="map"]').click()`);
    await new Promise((r) => setTimeout(r, 400));
    check('狭い画面ではチップを畳む', !(await shown('#day-filter')));
    check('畳むボタンが出る', await shown('#filter-toggle'));
    // 畳んでいる状態でこそ、地図が最初の画面に入る
    check('地図が画面の上のほうに来る', await page.evaluate<boolean>(
        `document.getElementById('mapscroll').getBoundingClientRect().top < 450`));
    await page.evaluate(`document.getElementById('filter-toggle').click()`);
    await new Promise((r) => setTimeout(r, 250));
    check('押すとチップが出る', await shown('#day-filter'));

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
