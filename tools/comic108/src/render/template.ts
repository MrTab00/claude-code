/**
 * 单文件 HTML 模板。数据以 JSON 内嵌, CSS/JS 全内联, 零外部依赖。
 * 双击即开, 也能直接发给别人。
 *
 * 配色は東/西/南の地区色でコード化している —— 会場で探すときに効くのは地区なので、
 * 装飾ではなく情報として色を使う。配置番号は等幅 + tabular-nums でカタログの表記に寄せる。
 */

import type { Dataset } from '../types';
import { FLOOR, buildBlockLookup, buildHallLookup, buildingIds } from './venue';

/** JSON 内嵌进 <script> 时必须把 < 转义掉, 否则 "</script>" 会提前闭合标签 */
function embedJson(data: unknown): string {
    return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * 主题令牌。宿主有三种状态:
 *   1. 未标记 —— 只有 prefers-color-scheme 能区分明暗
 *   2. data-theme="dark"  —— 显式选了暗色
 *   3. data-theme="light" —— 显式选了亮色, 必须能压过系统的暗色偏好
 * 所以暗色令牌要写两遍, 且颜色一律走令牌, 绝不直接写在 media / [data-theme] 块里。
 */
const DARK_TOKENS = `
  --paper: #161315;
  --surface: #1e1a1c;
  --surface-2: #241f22;
  --border: #322b2f;
  --ink: #ede8e9;
  --muted: #9c9195;
  --accent: #e58aa8;
  --accent-ink: #2a1119;
  --accent-soft: #35202a;
  --east: #7aa5e8;
  --east-soft: #1c2740;
  --west: #5cbfa3;
  --west-soft: #16302a;
  --south: #dfa06a;
  --south-soft: #382718;
  --flag: #e0a35c;
  --flag-soft: #322612;
  --sheet: #1a1719;
  --island: #322b2f;
  --shadow: none;
  --ring: rgba(229,138,168,.45);
`;

const CSS = `
:root {
  color-scheme: light dark;
  --paper: #f8f6f5;
  --surface: #ffffff;
  --surface-2: #fbf9f9;
  --border: #e6e1df;
  --ink: #1f1b1c;
  --muted: #7a7073;
  --accent: #8a3355;
  --accent-ink: #ffffff;
  --accent-soft: #f6e9ee;
  --east: #2a5ca8;
  --east-soft: #e8eef8;
  --west: #1f7a5c;
  --west-soft: #e4f2ec;
  --south: #b4652a;
  --south-soft: #f8ece1;
  --flag: #96590d;
  --flag-soft: #fbf0dd;
  --sheet: #f3efec;
  --island: #ded7d2;
  --shadow: 0 1px 2px rgba(31,27,28,.05), 0 2px 8px rgba(31,27,28,.04);
  --ring: rgba(138,51,85,.35);

  --sans: system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", "Segoe UI", sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, "Courier New", monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {${DARK_TOKENS}}
}
:root[data-theme="dark"] {${DARK_TOKENS}}

* { box-sizing: border-box; }
/*
 * hidden 属性を最優先にする。
 * ブラウザ既定の [hidden]{display:none} は特異性が最弱なので、#panel{display:flex} のような
 * 指定に負けてしまう —— それで詳細パネルが開きっぱなしになっていた。
 * 個別に打ち消すと同じ穴をまた作るので、ここで一括して止める。
 */
[hidden] { display: none !important; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font: 15px/1.65 var(--sans);
}
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; border-radius: 6px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }

.wrap { max-width: 1240px; margin: 0 auto; padding: 24px 16px 72px; display: flex; flex-direction: column; gap: 18px; }

/* --- ヘッダ: 概況を明細より先に --- */
.head { display: flex; flex-direction: column; gap: 10px; }
.eyebrow {
  font: 600 11px/1 var(--sans); letter-spacing: .14em; text-transform: uppercase;
  color: var(--accent);
}
.head h1 { font-size: 25px; line-height: 1.25; margin: 0; text-wrap: balance; letter-spacing: -.01em; }
.summary { display: flex; flex-wrap: wrap; gap: 20px; align-items: baseline; }
.stat { display: flex; align-items: baseline; gap: 6px; }
.stat b { font: 600 20px/1 var(--mono); font-variant-numeric: tabular-nums; }
.stat span { font-size: 12.5px; color: var(--muted); }
.gen { font-size: 12px; color: var(--muted); }

/* --- タブ --- */
.tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid var(--border); }
.tab {
  appearance: none; border: 0; background: none; color: var(--muted);
  font: 500 14.5px var(--sans); cursor: pointer;
  padding: 9px 14px; border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.tab:hover { color: var(--ink); }
.tab[aria-selected="true"] { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
.tab .n { font: 600 12px var(--mono); font-variant-numeric: tabular-nums; margin-left: 7px; opacity: .75; }

/* --- ツールバー --- */
.toolbar {
  position: sticky; top: 0; z-index: 20;
  display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
  padding: 11px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  box-shadow: var(--shadow);
}
.toolbar input[type=search] {
  flex: 1 1 250px; min-width: 0; padding: 8px 12px;
  font: 14px var(--sans); color: var(--ink);
  border: 1px solid var(--border); border-radius: 7px; background: var(--surface-2);
}
.toolbar input[type=search]::placeholder { color: var(--muted); }
.chips { display: flex; gap: 5px; flex-wrap: wrap; }
.chip {
  appearance: none; padding: 6px 11px; border-radius: 6px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--muted);
  font: 500 13px var(--sans); cursor: pointer;
}
.chip:hover { color: var(--ink); }
.chip[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.chip[data-value="東"][aria-pressed="true"] { background: var(--east-soft); border-color: var(--east); color: var(--east); }
.chip[data-value="西"][aria-pressed="true"] { background: var(--west-soft); border-color: var(--west); color: var(--west); }
.chip[data-value="南"][aria-pressed="true"] { background: var(--south-soft); border-color: var(--south); color: var(--south); }
.count { margin-left: auto; font: 500 12.5px var(--mono); font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap; }

/* --- 地図: 会場の形なりに並べる --- */
.mapwrap { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.mapbar {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  padding: 8px 0 10px;
}
/* 棟の絞り込み。会場でも「東は東、西は西」でしか動かないので、地図もその単位で切る */
.bldgbar { display: flex; gap: 6px; flex-wrap: wrap; padding: 10px 0 2px; }
.mapbar .note { font-size: 11.5px; color: var(--muted); flex: 1 1 240px; min-width: 0; }
.mapbar .note a { color: var(--accent); }
.mapbar .zoom { display: flex; gap: 6px; align-items: center; }
.mapbar .zoom span { font: 500 12px var(--mono); color: var(--muted); min-width: 44px; text-align: right; }
.zbtn {
  appearance: none; min-width: 44px; height: 44px; border: 1px solid var(--border); border-radius: 10px;
  background: var(--surface); color: var(--ink); cursor: pointer; font: 500 17px var(--sans); line-height: 1;
  touch-action: manipulation;
}
.zbtn.wide { padding: 0 14px; font-size: 13px; }
.mapscroll {
  overflow: auto; background: var(--sheet); border: 1px solid var(--border); border-radius: 12px;
  -webkit-overflow-scrolling: touch; touch-action: pan-x pan-y; overscroll-behavior: contain;
  /* 実際の高さは sizeMapScroll() が画面の残りぶんに合わせる */
  flex: 1; min-height: 300px;
}
/*
 * transform: scale() は要素が占める領域を変えないので、canvas をそのままスクロール領域に
 * 置くと縮小しても元の大きさぶんスクロールできてしまい、下や右に大きな空白が出る。
 * 外側の sizer に「実寸 × 倍率」を持たせて、スクロール範囲を見た目に合わせる。
 */
/* 縮小して余白が出たときは中央に置く。左に寄っていると会場が端に貼りついて見える */
.mapsizer { position: relative; margin: 0 auto; }
/* 会場の見取り図 1 枚ぶん。棟を真上から見た並びのまま置く */
.mapcanvas {
  --sw: 26px; --sh: 8px;
  position: absolute; top: 0; left: 0;
  transform-origin: 0 0; padding: 22px; width: max-content;
  display: flex; flex-direction: column; gap: 34px;
  background: var(--sheet);
}
/* 棟が横に並ぶ段。東7 と西は隣り合っている */
.frow { display: flex; gap: 40px; align-items: flex-start; }

/*
 * 1 棟。東1〜3 / 西1・2 / 南1・2 はそれぞれ地続きの建物なので枠はひとつ。
 * 中のホールの仕切りは破線で見せる。
 */
.bldg {
  border: 2px solid var(--ink); border-radius: 4px; padding: 10px 12px 12px; background: var(--surface);
}
.bldg[data-area="東"] { border-color: var(--east); }
.bldg[data-area="西"] { border-color: var(--west); }
.bldg[data-area="南"] { border-color: var(--south); }
.bldg.stray { border-color: var(--border); border-style: dashed; }
.bldg.stray > h4 { margin: 0 0 6px; font: 700 12px var(--sans); color: var(--muted); }
.bhalls { display: flex; }
.bhalls > .mhall + .mhall { border-left: 1.5px dashed var(--border); }

.mhall { display: flex; flex-direction: column; gap: 6px; padding: 0 12px; }
.bhalls > .mhall:first-child { padding-left: 0; }
.bhalls > .mhall:last-child { padding-right: 0; }
.mhall > .name { font: 700 12px var(--mono); color: var(--muted); }
.mhall[data-area="東"] > .name { color: var(--east); }
.mhall[data-area="西"] > .name { color: var(--west); }
.mhall[data-area="南"] > .name { color: var(--south); }
/* 壁サークルはホールの端に置く */
.hallbody { display: flex; gap: 14px; align-items: flex-start; }
.hsections { display: flex; flex-direction: column; gap: 22px; }
/* 段の中のまとまり同士は通路ぶん空ける */
.hsection { display: flex; gap: 20px; align-items: flex-start; }
/* 上下 2 段のホールで、短いほうの段が付く側 */
.hsection[data-align="right"] { justify-content: flex-end; }
.hgroup { display: flex; gap: 5px; align-items: flex-start; }

/* 島は通路で横に切られている。その隙間がこの gap */
.island { display: flex; flex-direction: column; gap: 7px; align-items: center; }
.island > .blk { font: 700 13px var(--mono); color: var(--ink); line-height: 1; }
.island.wall > .blk { writing-mode: horizontal-tb; }
/* 段の枠。短い島をその段の中で通路側に寄せるためだけのもの */
.bandslot { display: flex; }
/*
 * 島は 2 列。空きスペースは背景の線で描くので要素を作らない ——
 * 800 サークル規模で 6000 個の空マスを置くと重すぎる。
 */
.grid2 {
  display: grid; grid-template-columns: repeat(2, var(--sw));
  border: 1px solid var(--border); background: var(--surface);
  background-image:
    repeating-linear-gradient(to bottom, transparent 0 calc(var(--sh) - 1px), var(--border) calc(var(--sh) - 1px) var(--sh)),
    linear-gradient(to right, transparent calc(50% - 0.5px), var(--border) calc(50% - 0.5px) calc(50% + 0.5px), transparent calc(50% + 0.5px));
}
.sp {
  appearance: none; border: 0; padding: 0 2px; margin: 0; cursor: pointer; overflow: hidden;
  background: var(--accent-soft); color: var(--accent); text-align: left;
  font: 600 7px/1 var(--sans); display: flex; align-items: center; white-space: nowrap;
  outline: 1px solid var(--accent); touch-action: manipulation;
}
.sp[data-area="東"] { background: var(--east-soft); color: var(--east); outline-color: var(--east); }
.sp[data-area="西"] { background: var(--west-soft); color: var(--west); outline-color: var(--west); }
.sp[data-area="南"] { background: var(--south-soft); color: var(--south); outline-color: var(--south); }
.sp[data-mark="must"] { background: var(--accent); color: var(--accent-ink); outline-color: var(--accent); }
.sp[data-mark="like"] { outline-width: 2px; }
.sp[data-mark="skip"] { opacity: .35; }
.sp .num { opacity: .65; margin-right: 2px; font-variant-numeric: tabular-nums; }

/* 縮小時は文字を出さない。読めない字を並べても意味がなく、描画も重い */
.mapcanvas[data-detail="0"] .sp { font-size: 0; padding: 0; }
/* マス目も消して島を塗りつぶす。この縮尺では 1 本の帯として見えたほうが会場の形が分かる。
   ブロック記号だけは残す —— 縮小して全体を見るときに位置を掴む手がかりがこれしかない */
.mapcanvas[data-detail="0"] .grid2 { background-image: none; background: var(--island); border-color: var(--island); }
.mapcanvas[data-detail="0"] .blk { font-size: 9px; }
.mapcanvas[data-detail="1"] .sp .nm { display: none; }
.mapcanvas[data-detail="1"] .sp { font-size: 6.5px; }

/* --- カード --- *//* --- カード --- */
.grid { display: grid; gap: 13px; grid-template-columns: repeat(auto-fill, minmax(322px, 1fr)); }
.card {
  position: relative; overflow: hidden;
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 14px 15px 13px 18px; box-shadow: var(--shadow);
  display: flex; flex-direction: column; gap: 9px;
}
/* 左の縦帯で地区を示す: 会場で探すとき効くのは地区なので、色は装飾ではなく情報 */
.card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--border); }
.card[data-area="東"]::before { background: var(--east); }
.card[data-area="西"]::before { background: var(--west); }
.card[data-area="南"]::before { background: var(--south); }

.booth { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.b {
  font: 600 15.5px var(--mono); font-variant-numeric: tabular-nums; letter-spacing: -.01em;
  padding: 4px 9px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border);
}
/* 色は配置ごとに付ける。1 ツイートで東と南の両方を出す例があるので、カード単位だと嘘になる */
.b[data-area="東"] { color: var(--east); background: var(--east-soft); border-color: transparent; }
.b[data-area="西"] { color: var(--west); background: var(--west-soft); border-color: transparent; }
.b[data-area="南"] { color: var(--south); background: var(--south-soft); border-color: transparent; }
.b.unknown { font-family: var(--sans); font-size: 13px; font-weight: 500; color: var(--muted); background: none; border-style: dashed; }

.who { font-size: 13px; color: var(--muted); display: flex; gap: 6px; flex-wrap: wrap; align-items: baseline; }
.who strong { color: var(--ink); font-size: 14.5px; font-weight: 600; }
.who a { color: var(--accent); text-decoration: none; font-family: var(--mono); font-size: 12px; }
.who a:hover { text-decoration: underline; }

.tags { display: flex; gap: 5px; flex-wrap: wrap; }
.tag { font-size: 12px; padding: 3px 8px; border-radius: 5px; background: var(--surface-2); border: 1px solid var(--border); }
.tag.series { color: var(--muted); }

.body { font-size: 13.5px; white-space: pre-wrap; word-break: break-word; max-height: 7.4em; overflow: hidden; }
.body.open { max-height: none; }
.more { align-self: flex-start; background: none; border: 0; color: var(--accent); cursor: pointer; font: 500 12.5px var(--sans); padding: 0; }
.more:hover { text-decoration: underline; }

/*
 * お品書きは配置番号や頒価が画像の中に書かれていることが多い。切り抜くと肝心の文字が
 * 消えるので object-fit は contain 固定、1 枚しかない時はカードの主役として大きく出す。
 */
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 5px; }
.shots img {
  width: 100%; aspect-ratio: 1; object-fit: contain; border-radius: 7px;
  cursor: zoom-in; background: var(--surface-2); border: 1px solid var(--border);
}
.shots.one { display: block; }
.shots.one img { aspect-ratio: auto; max-height: 520px; }

.foot {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  margin-top: auto; padding-top: 4px; font-size: 12px; color: var(--muted);
}
.foot .src { margin-left: auto; color: var(--accent); text-decoration: none; white-space: nowrap; }
.foot .src:hover { text-decoration: underline; }
.flag { font-size: 11px; padding: 2px 7px; border-radius: 4px; background: var(--flag-soft); color: var(--flag); }

#more-sentinel { height: 1px; }
.empty { text-align: center; color: var(--muted); padding: 64px 16px; font-size: 14px; }

#lightbox {
  position: fixed; inset: 0; background: rgba(10,8,9,.9); display: none;
  align-items: center; justify-content: center; z-index: 60; cursor: zoom-out; padding: 24px;
}
#lightbox.on { display: flex; }
#lightbox img { max-width: 100%; max-height: 100%; border-radius: 8px; }

/* --- チェック状態 --- */
.marks { display: flex; gap: 4px; flex-wrap: wrap; }
.mk {
  appearance: none; cursor: pointer; font: 500 12px var(--sans);
  padding: 4px 9px; border-radius: 6px; border: 1px solid var(--border);
  background: var(--surface-2); color: var(--muted);
}
.mk[aria-pressed="true"][data-mk="must"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.mk[aria-pressed="true"][data-mk="like"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.mk[aria-pressed="true"][data-mk="skip"] { background: var(--border); color: var(--ink); }
.mk[aria-pressed="true"][data-mk="buy"]  { background: var(--west-soft); border-color: var(--west); color: var(--west); }
.card[data-mark="skip"] { opacity: .5; }
.card[data-mark="must"] { border-color: var(--accent); }
.card[data-bought="true"] .booth, .card[data-bought="true"] .who { opacity: .75; }
.flag.new { background: var(--accent-soft); color: var(--accent); }

/* --- 第二ツールバー(道具類) --- */
.toolbar2 { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; margin-top: -8px; }
.toolbar2 .spacer { flex: 1; }

/* --- 表ビュー --- */
.ltable-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow); }
.ltable { border-collapse: collapse; width: 100%; font-size: 13px; }
.ltable th {
  text-align: left; font: 600 11.5px var(--sans); letter-spacing: .04em; color: var(--muted);
  padding: 9px 10px; border-bottom: 1px solid var(--border); white-space: nowrap;
}
.ltable td { padding: 7px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
.ltable tr:last-child td { border-bottom: 0; }
.ltable tbody tr { cursor: pointer; }
.ltable tbody tr:hover td { background: var(--surface-2); }
.ltable .b { font-size: 12.5px; padding: 2px 6px; }
.ltable .st { font-size: 13px; white-space: nowrap; letter-spacing: .1em; }
.ltable .memo-cell { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
.ltable a { color: var(--accent); text-decoration: none; }
.ltable tr[data-mark="skip"] td { opacity: .5; }

/* --- 詳細パネル --- */
#backdrop { position: fixed; inset: 0; background: rgba(10,8,9,.45); z-index: 40; }
#panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: min(440px, 100vw);
  background: var(--surface); border-left: 1px solid var(--border); z-index: 50;
  overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
}
#panel-body { display: flex; flex-direction: column; gap: 12px; }
#panel .close {
  position: absolute; top: 10px; right: 12px; appearance: none; border: 0; background: none;
  font-size: 20px; color: var(--muted); cursor: pointer; line-height: 1; padding: 4px;
}
#panel h2 { margin: 0; font-size: 17px; padding-right: 28px; }
#panel .memo {
  width: 100%; min-height: 64px; resize: vertical; font: 13.5px/1.5 var(--sans);
  color: var(--ink); background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px;
}
#panel .memo::placeholder { color: var(--muted); }
#panel .post { border-top: 1px solid var(--border); padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
#panel .post time { font-size: 11.5px; color: var(--muted); }
#panel .post .body { max-height: none; }
#panel .sec { font: 600 11px var(--sans); letter-spacing: .1em; color: var(--muted); text-transform: uppercase; }

/* --- フッタ(公開向けの断り書き) --- */
.site-note { font-size: 11.5px; color: var(--muted); line-height: 1.7; border-top: 1px solid var(--border); padding-top: 14px; }
.site-note a { color: var(--accent); }

/* --- 印刷: 今の絞り込み・並び順の表だけを出す --- */
#printtable { display: none; }
@media print {
  body * { visibility: hidden; }
  #printtable, #printtable * { visibility: visible; }
  #printtable { display: block; position: absolute; inset: 0; padding: 0; }
  #printtable table { border-collapse: collapse; width: 100%; font: 10.5px/1.4 sans-serif; }
  #printtable th, #printtable td { border: 1px solid #999; padding: 3px 5px; text-align: left; }
  #printtable th { background: #eee; }
}

/* 絞り込みの開閉ボタン。狭い画面でだけ出す */
#filter-toggle { display: none; }

/* --- 手のひらで使う前提の調整 --- */
@media (max-width: 720px) {
  /*
   * 狭い画面ではチップが何段にも折り返して、地図が画面外まで押し下げられていた。
   * 見出しの数字はタブにも出ているので省き、絞り込みは畳んで、まず地図を見せる。
   */
  .summary, .gen { display: none; }
  #filter-toggle { display: inline-flex; align-items: center; }
  body:not(.filters-open) .toolbar > .chips { display: none; }
  body:not(.filters-open) .count { display: none; }
  .toolbar { position: static; }

  .wrap { padding: 12px 10px 40px; gap: 12px; }
  .grid { grid-template-columns: 1fr; }
  .head h1 { font-size: 20px; }
  .summary { gap: 14px; }

  /* 指で押せる大きさにする */
  .tab { padding: 12px 14px; font-size: 15px; min-height: 46px; }
  .chip { padding: 10px 13px; font-size: 14px; min-height: 42px; }
  .mk { padding: 10px 12px; font-size: 13px; min-height: 42px; }
  .toolbar input[type=search] { min-height: 44px; font-size: 16px; } /* 16px 未満だと iOS が勝手に拡大する */
  .toolbar { padding: 9px; gap: 7px; }
  .count { margin-left: 0; width: 100%; text-align: right; }

  #panel { width: 100vw; border-left: 0; }
  #panel .close { width: 44px; height: 44px; font-size: 24px; }
  .mapscroll { min-height: 66vh; }
  .mapbar { padding: 6px 0 8px; }
  .mapbar .note { display: none; }
  .ltable th, .ltable td { padding: 10px 8px; }
}
`;

const JS = String.raw`
const DATA = JSON.parse(document.getElementById('c108-data').textContent);
const DAY_LABEL = Object.fromEntries(DATA.event.days.map(d => [d.day, d.label]));

const SOURCE_LABEL = { name: '表示名', bio: 'プロフィール', account: '別ツイート' };

// 公式配置図から起こしたホール構成と、ブロック→ホールの逆引き
const FLOOR = __FLOOR__;
const HALL_OF = __HALL_OF__;
const BLOCK_OF = __BLOCK_OF__;

/** ツイートの配置を公式表記に揃える。揃わないものは null(構成表に無いブロック) */
function official(b) {
  if (!b || !b.block || !b.area) return null;
  const key = b.area + '/' + String(b.block).toLowerCase();
  const hall = HALL_OF[key];
  return hall ? { area: b.area, hall, block: BLOCK_OF[key] } : null;
}

const state = { tab: 'map', kind: 'circles', q: '', days: new Set(), areas: new Set(), mediaOnly: false,
  grouped: true, sort: 'space', view: 'cards', markFilter: new Set(), buyFilter: 'all',
  bldg: '' };

/**
 * チェック・購入・メモは端末内(localStorage)にだけ保存する。サーバは無い。
 * key はアカウント名 —— 再採集して build し直してもツイート id が変わるだけで
 * アカウントは変わらないので、印が生き残る。
 */
const STORE_KEY = 'c108-plan-v1';
const store = (() => {
  try { return Object.assign({ marks: {}, seen: {}, init: false }, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); }
  catch { return { marks: {}, seen: {}, init: false }; }
})();
function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch {} }
const markOf = sn => store.marks[sn] || {};
function setMark(sn, patch) {
  store.marks[sn] = Object.assign({}, store.marks[sn], patch);
  const m = store.marks[sn];
  if (!m.s && !m.b && !m.m) delete store.marks[sn];
  saveStore();
}

/** 初回訪問では全部を既読扱いにする —— 全カードに「新着」が付いても意味がない */
function initSeen(entries) {
  if (store.init) return;
  for (const e of entries) {
    const prev = store.seen[e.screenName];
    if (!prev || e.createdAt > prev) store.seen[e.screenName] = e.createdAt;
  }
  store.init = true;
  saveStore();
}
const isNew = e => store.init && (!store.seen[e.screenName] || e.createdAt > store.seen[e.screenName]);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
// ローカル保存 > 埋め込み > ホットリンク の順。保存してあれば X 側が消えても残る
const thumb = m => m.local || m.dataUri || (m.url.includes('pbs.twimg.com') ? m.url + '?name=small' : m.url);
const full  = m => m.local || m.dataUri || (m.url.includes('pbs.twimg.com') ? m.url + '?name=large' : m.url);

/** 一条记录参与搜索的全部文本 */
function haystack(e) {
  return [
    e.displayName, e.screenName, e.circleName, e.text,
    (e.works || []).join(' '), (e.characters || []).join(' '),
    (e.series || []).join(' '), (e.locations || []).join(' '),
    (e.booths || []).map(b => b.display + ' ' + b.raw).join(' '),
  ].filter(Boolean).join(' ').toLowerCase();
}

const entryDays  = e => (e.days && e.days.length ? e.days : [...new Set((e.booths || []).map(b => b.day).filter(Boolean))]);

const uniq = xs => [...new Set(xs)];

const AREA_ORDER = { '東': 0, '西': 1, '南': 2 };

/**
 * 配置順の並びキー。会場は日程 → 地区 → ホール → ブロック → 番号 の順に歩くので、
 * 一覧もその順に並んでいないと現地で使えない。配置が無いものは最後に送る。
 */
function boothKey(e) {
  const b = (e.booths || [])[0];
  if (!b) return [9, 9, 99, 'zz', 99, 'z'];
  return [
    b.day ?? 8,
    AREA_ORDER[b.area] ?? 8,
    Number(b.hall) || 0,
    b.block ?? 'zz',
    b.number ?? 99,
    b.ab ?? 'z',
  ];
}

function bySpace(a, b) {
  const ka = boothKey(a), kb = boothKey(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

const byNewest = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt));

/** どの配置がより信頼できるか。本文由来 > 表示名/プロフ由来 > 部分的 > 別ツイートからの借り物 */
function boothScore(e) {
  const b = (e.booths || [])[0];
  if (!b) return 0;
  if (b.source === 'account') return 1;
  if (b.confidence !== 'high') return 2;
  return b.source ? 3 : 4;
}

/**
 * 同じアカウントの投稿を 1 枚にまとめる。
 * 1 サークルがお品書きを何度も投稿するのは普通なので、ツイート単位のままだと
 * 数百件規模で同じサークルが画面を埋めてしまう。探すのはサークルであってツイートではない。
 */
function groupByAccount(list) {
  const map = new Map();
  for (const e of list) {
    const prev = map.get(e.screenName);
    if (!prev) { map.set(e.screenName, { ...e, posts: 1 }); continue; }

    const better = boothScore(e) > boothScore(prev);
    const base = better ? e : prev;
    const seen = new Set();
    const media = [...(prev.media || []), ...(e.media || [])].filter(m => !seen.has(m.url) && seen.add(m.url));

    map.set(e.screenName, {
      ...base,
      posts: prev.posts + 1,
      media: media.slice(0, 12),
      works: uniq([...(prev.works || []), ...(e.works || [])]),
      characters: uniq([...(prev.characters || []), ...(e.characters || [])]),
      series: uniq([...(prev.series || []), ...(e.series || [])]),
      locations: uniq([...(prev.locations || []), ...(e.locations || [])]),
      days: uniq([...entryDays(prev), ...entryDays(e)]).sort(),
      price: prev.price || e.price,
      hasShinagaki: prev.hasShinagaki || e.hasShinagaki,
      createdAt: prev.createdAt > e.createdAt ? prev.createdAt : e.createdAt,
    });
  }
  return [...map.values()];
}
const entryAreas = e => [...new Set((e.booths || []).map(b => b.area).filter(Boolean))];

function matches(e) {
  if (state.q && !haystack(e).includes(state.q)) return false;
  if (state.mediaOnly && !(e.media && e.media.length)) return false;

  // 日程・地区が読み取れなかった項目は絞り込みで隠さない。解析できなかっただけで、該当しないとは限らない
  if (state.days.size) {
    const d = entryDays(e);
    if (d.length && !d.some(x => state.days.has(x))) return false;
  }
  if (state.areas.size) {
    const a = entryAreas(e);
    if (a.length && !a.some(x => state.areas.has(x))) return false;
  }

  const mk = markOf(e.screenName);
  if (state.markFilter.size && !state.markFilter.has(mk.s)) return false;
  if (state.buyFilter === 'todo' && mk.b) return false;
  if (state.buyFilter === 'done' && !mk.b) return false;
  return true;
}

function boothHtml(e) {
  const bs = e.booths || [];
  if (!bs.length) return '<div class="booth"><span class="b unknown">配置 未取得</span></div>';
  return '<div class="booth">' + bs.map(b =>
    '<span class="b"' + (b.area ? ' data-area="' + esc(b.area) + '"' : '') + '>' + esc(b.display) + '</span>' +
    (b.source
      ? '<span class="flag" title="このツイート本文には配置が無く、' + SOURCE_LABEL[b.source] + 'から読み取りました">' + SOURCE_LABEL[b.source] + 'より</span>'
      : b.confidence === 'low' ? '<span class="flag" title="一部しか読み取れていません">要確認</span>' : '')
  ).join('') + '</div>';
}

function shotsHtml(e) {
  if (!e.media || !e.media.length) return '';
  // 画像が消えている(削除済み・オフライン)場合は枠ごと隠す。壊れたアイコンを並べても仕方ない
  return '<div class="shots' + (e.media.length === 1 ? ' one' : '') + '">' + e.media.map(m =>
    '<img loading="lazy" onerror="this.remove()" src="' + esc(thumb(m)) + '" data-full="' + esc(full(m)) + '" alt="">'
  ).join('') + '</div>';
}

function whoHtml(e) {
  return '<div class="who">' +
    (e.circleName ? '<strong>' + esc(e.circleName) + '</strong>' +
      (e.circleNameConfidence === 'low' ? '<span class="flag" title="サークル名は推定です">推定</span>' : '') : '') +
    '<a href="https://x.com/' + esc(e.screenName) + '" target="_blank" rel="noopener">@' + esc(e.screenName) + '</a>' +
    '</div>';
}

function tagsHtml(e) {
  const out = [];
  for (const c of e.characters || []) out.push('<span class="tag">' + esc(c) + '</span>');
  for (const s of e.series || []) out.push('<span class="tag series">' + esc(s) + '</span>');
  for (const w of e.works || []) out.push('<span class="tag">' + esc(w) + '</span>');
  return out.length ? '<div class="tags">' + out.join('') + '</div>' : '';
}

function footHtml(e) {
  const bits = [];
  const d = entryDays(e);
  if (d.length) bits.push(esc(d.map(x => DAY_LABEL[x] || x + '日目').join(' / ')));
  if (e.locations && e.locations.length) bits.push(esc(e.locations.join(' · ')));
  if (e.price) bits.push(esc(e.price));
  if (e.hasShinagaki) bits.push('お品書きあり');
  if (e.dual) bits.push('サークル兼レイヤー');
  if (e.posts > 1) bits.push(esc(e.posts) + ' 投稿をまとめて表示');

  let html = '<div class="foot">' + (bits.length ? '<span>' + bits.join(' · ') + '</span>' : '');
  if (e.charactersConfidence === 'low' && (e.characters || []).length)
    html += '<span class="flag" title="本文からの推定です">キャラ推定</span>';
  return html + '<a class="src" href="' + esc(e.url) + '" target="_blank" rel="noopener">原文 ↗</a></div>';
}

const MARK_DEFS = [['must', '★絶対'], ['like', '♡気になる'], ['skip', '⊖見送り'], ['buy', '✓購入済']];

function marksHtml(sn) {
  const m = markOf(sn);
  return '<div class="marks" data-sn="' + esc(sn) + '">' + MARK_DEFS.map(([k, label]) =>
    '<button class="mk" type="button" data-mk="' + k + '" aria-pressed="' +
    (k === 'buy' ? !!m.b : m.s === k) + '">' + label + '</button>'
  ).join('') + '</div>';
}

function cardHtml(e) {
  const area = entryAreas(e)[0];
  const m = markOf(e.screenName);
  return '<article class="card" data-sn="' + esc(e.screenName) + '"' +
    (area ? ' data-area="' + esc(area) + '"' : '') +
    (m.s ? ' data-mark="' + m.s + '"' : '') + (m.b ? ' data-bought="true"' : '') + '>' +
    (e.kind === 'circle' ? boothHtml(e) : '') +
    whoHtml(e) + (isNew(e) ? '<div><span class="flag new">新着</span></div>' : '') + tagsHtml(e) +
    shotsHtml(e) +
    (e.text ? '<div class="body">' + esc(e.text) + '</div><button class="more" type="button">全文を表示</button>' : '') +
    (m.m ? '<div class="foot">📝 ' + esc(m.m) + '</div>' : '') +
    marksHtml(e.screenName) +
    footHtml(e) +
  '</article>';
}

const MARK_ICON = { must: '★', like: '♡', skip: '⊖' };

function rowHtml(e) {
  const m = markOf(e.screenName);
  const st = (m.s ? MARK_ICON[m.s] : '') + (m.b ? '✓' : '');
  return '<tr data-sn="' + esc(e.screenName) + '"' + (m.s ? ' data-mark="' + m.s + '"' : '') + '>' +
    '<td class="st">' + st + '</td>' +
    '<td>' + (e.booths || []).map(b => '<span class="b"' + (b.area ? ' data-area="' + esc(b.area) + '"' : '') + '>' + esc(b.display) + '</span>').join(' ') + '</td>' +
    '<td>' + esc(e.circleName || e.displayName) + ' <a href="https://x.com/' + esc(e.screenName) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">@' + esc(e.screenName) + '</a></td>' +
    '<td>' + esc(e.price || '') + '</td>' +
    '<td class="memo-cell">' + esc(m.m || '') + '</td>' +
    '<td><a href="' + esc(e.url) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">原文</a></td>' +
  '</tr>';
}

/** 現在の一覧。グループ化の有無で件数そのものが変わる */
function rowsFor(kind) {
  return state.grouped ? groupByAccount(DATA[kind]) : DATA[kind];
}

/**
 * 配置を「地区/ホール/ブロック/番号」ごとにまとめる。
 * ブロック記号からホールと表記を引き直すので、ツイートにホール番号が無くても、
 * 大文字小文字が揺れていても、正しいマスに入る。
 */
function buildSpaceIndex(rows) {
  const spaces = new Map(); // "地区/ホール/ブロック/番号" -> 項目[]
  const strays = new Map();
  for (const e of rows) {
    for (const b of e.booths || []) {
      const o = official(b);
      if (!o) {
        if (b.block && b.area) strays.set(b.area + '/' + b.block, (strays.get(b.area + '/' + b.block) || 0) + 1);
        continue;
      }
      const key = o.area + '/' + o.hall + '/' + o.block + '/' + (b.number ?? 0);
      if (!spaces.has(key)) spaces.set(key, []);
      const at = spaces.get(key);
      if (!at.some(x => x.screenName === e.screenName)) at.push(e);
    }
  }
  return { spaces, strays };
}

/**
 * 島の中でのスペースの位置。venue.ts の spacePosition と同じ規則。
 *
 * 配置図どおり、右列を下から上へ 1..N/2、左列を上から下へ N/2+1..N と蛇行させる
 * (島の最下段が「N｜1」になっているのがその形)。島は通路で何段かに切られているので、
 * 上から数えた行番号がどの段に入るかも返す。
 */
function spacePos(num, bands) {
  const half = bands.reduce((a, b) => a + b, 0);
  if (num < 1 || num > half * 2) return null;
  const col = num <= half ? 2 : 1;
  const fromTop = num <= half ? half - num + 1 : num - half;

  let rest = fromTop;
  for (let b = 0; b < bands.length; b++) {
    if (rest <= bands[b]) return { band: b, row: rest, col: col };
    rest -= bands[b];
  }
  return null;
}

/**
 * その段で最も背の高い島に合わせた各段の行数。
 * 短い島は通路側に寄せる(配置図でも端の島は通路の側から詰まっている)ので、
 * どの島も同じ高さの枠に入れておくとブロック記号の行が揃う。
 */
function sectionSlots(section) {
  const all = section.groups.flat();
  const depth = Math.max(...all.map(i => i.bands.length));
  const slots = [];
  for (let i = 0; i < depth; i++) slots.push(Math.max(...all.map(x => x.bands[i] || 0)));
  return slots;
}

function islandHtml(area, hallNo, island, slots, letterAfter, spaces, isWall) {
  const block = island.block;
  const key = n => area + '/' + hallNo + '/' + block + '/' + n;

  const bands = island.bands.slice();
  let total = bands.reduce((a, b) => a + b, 0) * 2;

  // 実データが配置図を超えていたら最下段を伸ばす。番号が枠外に落ちて消えるより良い。
  // ただしブロック記号より上を伸ばすと記号の行が隣とずれるので、その場合は段を足す
  let maxNum = total;
  for (let n = total + 1; n <= total + 40; n++) if (spaces.has(key(n))) maxNum = n;
  if (maxNum > total) {
    const extra = Math.ceil((maxNum - total) / 2);
    if (bands.length - 1 > letterAfter) bands[bands.length - 1] += extra;
    else bands.push(extra);
    total += extra * 2;
  }

  const cells = bands.map(() => '');
  for (let n = 1; n <= total; n++) {
    const at = spaces.get(key(n));
    if (!at || !at.length) continue;
    const p = spacePos(n, bands);
    if (!p) continue;
    const names = at.map(e => e.circleName || e.displayName);
    const mark = markOf(at[0].screenName).s;
    cells[p.band] += '<button class="sp" type="button" data-area="' + esc(area) + '"' +
      (mark ? ' data-mark="' + mark + '"' : '') +
      ' data-sn="' + esc(at[0].screenName) + '" style="grid-column:' + p.col + ';grid-row:' + p.row + '"' +
      ' title="' + esc(area + hallNo + ' ' + block + '-' + String(n).padStart(2, '0') + '  ' + names.join(' / ')) + '">' +
      '<span class="num">' + n + '</span><span class="nm">' + esc(names.join('/')) + '</span></button>';
  }

  // ブロック記号は配置図と同じく通路の切れ目に置く。壁は帯が 1 本なので先頭
  const label = '<span class="blk">' + esc(block) + '</span>';
  let body = letterAfter < 0 ? label : '';
  bands.forEach((rows, i) => {
    const slot = Math.max(slots[i] || 0, rows);
    // 偶数段は下寄せ、奇数段は上寄せ。こうすると短い島が通路の側へ詰まる
    const align = i % 2 === 0 ? 'flex-end' : 'flex-start';
    body += '<div class="bandslot" style="height:calc(' + slot + ' * var(--sh) + 2px);align-items:' + align + '">' +
      '<div class="grid2" style="grid-template-rows:repeat(' + rows + ',var(--sh))">' + cells[i] + '</div></div>';
    if (i === letterAfter) body += label;
  });

  return '<div class="island' + (isWall ? ' wall' : '') + '">' + body + '</div>';
}

/** ホール 1 つ。段 → 通路で区切られたまとまり → 島、の順に組む */
function hallHtml(area, hall, spaces) {
  const sections = hall.sections.map(sec => {
    const slots = sectionSlots(sec);
    // 短いほうの段をどちら側に寄せるか。西2 は下段が右端(さこけくき の下)に付く
    return '<div class="hsection"' + (sec.align === 'right' ? ' data-align="right"' : '') + '>' +
      sec.groups.map(group =>
      '<div class="hgroup">' + group.map(isl =>
        islandHtml(area, hall.hall, isl, slots, sec.letterAfter, spaces, false)
      ).join('') + '</div>'
    ).join('') + '</div>';
  }).join('');

  const wall = hall.wall
    ? islandHtml(area, hall.hall, { block: hall.wall.block, bands: [Math.ceil(hall.wall.spaces / 2)] },
        [], -1, spaces, true)
    : '';
  const body = hall.wall && hall.wall.side === 'left'
    ? wall + '<div class="hsections">' + sections + '</div>'
    : '<div class="hsections">' + sections + '</div>' + wall;

  return '<div class="mhall" data-area="' + esc(area) + '"><span class="name">' + esc(area + hall.hall) +
         'ホール</span><div class="hallbody">' + body + '</div></div>';
}

function renderMap(rows) {
  const wrap = document.getElementById('mapwrap');
  if (state.tab !== 'map') { wrap.hidden = true; return; }
  wrap.hidden = false;

  const { spaces, strays } = buildSpaceIndex(rows);
  let html = '';

  // 会場を真上から見た並びのまま組む。棟が横に並ぶ段はそのまま横に並べる
  for (const row of FLOOR) {
    const shown = row.buildings.filter(b => !state.bldg || state.bldg === b.id);
    if (!shown.length) continue;
    html += '<div class="frow">' + shown.map(b =>
      '<div class="bldg" data-area="' + esc(b.area) + '" data-id="' + esc(b.id) + '">' +
      '<div class="bhalls">' + b.halls.map(h => hallHtml(b.area, h, spaces)).join('') + '</div></div>'
    ).join('') + '</div>';
  }

  if (strays.size && !state.bldg) {
    const list = [...strays.entries()].map(([k, n]) => esc(k.replace('/', ' ')) + ' (' + n + ')').join('  ');
    html += '<div class="frow"><div class="bldg stray"><h4>構成表に無いブロック</h4>' +
            '<div class="note">' + list + '</div></div></div>';
  }

  document.getElementById('mapcanvas').innerHTML = html;
  measureCanvas();
  applyZoom(zoom);
}

// --- 拡大縮小 ---
let zoom = 1;
let natural = { w: 0, h: 0 };

/** 倍率 1 のときの実寸。描き直すたびに測り直す */
function measureCanvas() {
  const canvas = document.getElementById('mapcanvas');
  const t = canvas.style.transform;
  canvas.style.transform = 'none';
  // scrollHeight は下の padding を含まないことがあり、sizer と 数 px ずれる。
  // 見た目の箱そのものを測る offset* のほうが合う
  natural = { w: canvas.offsetWidth, h: canvas.offsetHeight };
  canvas.style.transform = t;
}

function applyZoom(z) {
  // 下限は低めに。会場は横に長いので、狭い画面だと全体表示で 10% 台になる。
  // 縮小時は文字を出さないので、小さくても輪郭の見取り図としては成立する
  zoom = Math.min(4, Math.max(0.07, z));
  const canvas = document.getElementById('mapcanvas');
  canvas.style.transform = 'scale(' + zoom + ')';

  // スクロール範囲を見た目の大きさに合わせる
  const sizer = document.getElementById('mapsizer');
  sizer.style.width = Math.round(natural.w * zoom) + 'px';
  sizer.style.height = Math.round(natural.h * zoom) + 'px';

  // 縮小時は文字を出さない。読めない字を並べても意味がないし、描画も重い
  canvas.dataset.detail = zoom < 0.7 ? '0' : zoom < 1.25 ? '1' : '2';
  document.getElementById('zoomlabel').textContent = Math.round(zoom * 100) + '%';
}

/**
 * 地図を画面の残りにちょうど収める。
 * 見出しと絞り込みの下に固定の高さで置くと、地図の中とページの両方がスクロールして
 * どちらを動かしているのか分からなくなる。残りいっぱいまで伸ばして外側は動かさない。
 */
function sizeMapScroll() {
  const scroll = document.getElementById('mapscroll');
  const top = scroll.getBoundingClientRect().top + window.scrollY;
  // flex: 1 のままだと height を無視されるので、こちらで決めると宣言してから入れる
  scroll.style.flex = 'none';
  scroll.style.height = Math.max(300, window.innerHeight - top - 16) + 'px';
}

/** 会場が丸ごと収まる倍率にして左上へ戻す。縦も入れないと南まで見えない */
function fitZoom() {
  sizeMapScroll();
  measureCanvas();
  const scroll = document.getElementById('mapscroll');
  const pad = 4;
  const byW = natural.w ? (scroll.clientWidth - pad) / natural.w : 1;
  const byH = natural.h ? (scroll.clientHeight - pad) / natural.h : 1;
  applyZoom(Math.min(byW, byH));
  scroll.scrollTo(0, 0);
}

function render() {
  const onMap = state.tab === 'map';
  const kind = onMap ? 'circles' : state.tab;
  const all = rowsFor(kind);
  const base = all.filter(matches);
  const list = base.sort(state.sort === 'space' ? bySpace : byNewest);
  lastList = list;

  renderMap(base);
  document.getElementById('count').textContent =
    list.length + ' / ' + all.length + (state.grouped ? ' 組' : ' 件');

  for (const t of ['circles', 'cosplayers', 'unclassified']) {
    const n = rowsFor(t).length;
    const badge = document.querySelector('.tab[data-tab="' + t + '"] .n');
    if (badge) badge.textContent = n;
    const stat = document.getElementById('stat-' + t);
    if (stat) stat.textContent = n;
  }
  // 地区で絞れるのはサークルだけ。地図タブでは常に出す
  document.getElementById('area-filter').hidden = !onMap && state.tab !== 'circles';
  document.querySelector('.viewpick').hidden = onMap;
  // CSV・印刷・持ち出しは一覧のための道具。地図では場所を取るだけなので隠す
  document.querySelector('.toolbar2').hidden = onMap;

  const grid = document.getElementById('grid');
  const twrap = document.getElementById('ltable-wrap');

  if (onMap) {
    grid.hidden = true;
    twrap.hidden = true;
    document.getElementById('empty').hidden = true;
    return;
  }

  if (state.view === 'table') {
    grid.hidden = true;
    twrap.hidden = false;
    twrap.innerHTML = '<table class="ltable"><thead><tr>' +
      '<th>状態</th><th>配置</th><th>サークル</th><th>金額</th><th>メモ</th><th></th>' +
      '</tr></thead><tbody>' + list.map(rowHtml).join('') + '</tbody></table>';
  } else {
    twrap.hidden = true;
    grid.hidden = false;
    grid.innerHTML = '';
    queue = list.slice();
    appendChunk();
  }
  document.getElementById('empty').hidden = list.length > 0;
}

let lastList = [];

/**
 * カードは少しずつ足す。
 *
 * 800 枚を一度に組むと最初の描画に 1 秒以上かかり、絞り込みのたびに固まる。
 * 画面に入るのはせいぜい十数枚なので、下端が見えたら次を足す方式にする。
 * CSV・印刷は絞り込み結果の全件(lastList)を使うので、この分割の影響を受けない。
 */
const CHUNK = 60;
let queue = [];

function appendChunk() {
  const grid = document.getElementById('grid');
  const sentinel = document.getElementById('more-sentinel');
  if (!queue.length) { sentinel.hidden = true; return; }

  const slice = queue.splice(0, CHUNK);
  const holder = document.createElement('div');
  holder.innerHTML = slice.map(cardHtml).join('');
  const cards = [...holder.children];
  grid.append(...cards);

  // 読みと書きは必ず分ける: scrollHeight の読み取りはレイアウトを強制し、
  // remove() はそれを無効化する。同じループでやると 1 枚ごとに同期レイアウトが走る。
  const drop = [];
  for (const card of cards) {
    const body = card.querySelector('.body');
    const more = card.querySelector('.more');
    if (body && more && body.scrollHeight <= body.clientHeight + 2) drop.push(more);
  }
  for (const more of drop) more.remove();

  sentinel.hidden = !queue.length;
}

/** 今の絞り込み・並び順のまま CSV にする(Excel 向けに BOM 付き UTF-8) */
function buildCsv() {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['状態', '購入済', '日程', '配置', 'サークル名', 'アカウント', '金額', '作品・キャラ', 'メモ', 'URL']];
  for (const e of lastList) {
    const m = markOf(e.screenName);
    rows.push([
      m.s === 'must' ? '絶対' : m.s === 'like' ? '気になる' : m.s === 'skip' ? '見送り' : '',
      m.b ? '済' : '',
      entryDays(e).map(d => d + '日目').join('/'),
      (e.booths || []).map(b => b.display).join(' / '),
      e.circleName || e.displayName,
      '@' + e.screenName,
      e.price || '',
      [...(e.works || []), ...(e.characters || [])].join(' / '),
      m.m || '',
      e.url,
    ]);
  }
  return '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** 印刷は常に「今の一覧の表」。カードのまま刷ると画像で紙が尽きる */
function printList() {
  const q = esc;
  document.getElementById('printtable').innerHTML =
    '<table><thead><tr><th>✓</th><th>状態</th><th>配置</th><th>サークル</th><th>金額</th><th>メモ</th></tr></thead><tbody>' +
    lastList.map(e => {
      const m = markOf(e.screenName);
      return '<tr><td>' + (m.b ? '✓' : '　') + '</td><td>' + (m.s ? { must: '絶対', like: '気になる', skip: '見送り' }[m.s] : '') +
        '</td><td>' + q((e.booths || []).map(b => b.display).join(' / ')) +
        '</td><td>' + q(e.circleName || e.displayName) + ' @' + q(e.screenName) +
        '</td><td>' + q(e.price || '') + '</td><td>' + q(m.m || '') + '</td></tr>';
    }).join('') + '</tbody></table>';
  window.print();
}

/** 詳細パネル: そのアカウントの全投稿と、印・メモの編集 */
function openPanel(sn) {
  // タブに関係なく開けるようにする。地図タブでは DATA['map'] などという配列は無いし、
  // サークル兼レイヤーはどちらの一覧からでも開かれうる
  const kind = ['circles', 'cosplayers', 'unclassified'].find(k => DATA[k].some(e => e.screenName === sn));
  if (!kind) return;
  const posts = DATA[kind].filter(e => e.screenName === sn)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const head = (state.grouped ? rowsFor(kind) : posts).find(e => e.screenName === sn) || posts[0];
  const m = markOf(sn);

  document.getElementById('panel-body').innerHTML =
    boothHtml(head) +
    '<h2>' + esc(head.circleName || head.displayName) + '</h2>' +
    '<div class="who"><a href="https://x.com/' + esc(sn) + '" target="_blank" rel="noopener">@' + esc(sn) + '</a></div>' +
    marksHtml(sn) +
    tagsHtml(head) +
    '<div class="sec">メモ</div>' +
    '<textarea class="memo" id="panel-memo" placeholder="新刊あり / 無配欲しい / 時間あれば 等">' + esc(m.m || '') + '</textarea>' +
    '<div class="sec">投稿 (' + posts.length + ')</div>' +
    posts.map(e =>
      '<div class="post"><time>' + esc((e.createdAt || '').slice(0, 16).replace('T', ' ')) + '</time>' +
      shotsHtml(e) +
      (e.text ? '<div class="body">' + esc(e.text) + '</div>' : '') +
      '<div class="foot"><a class="src" href="' + esc(e.url) + '" target="_blank" rel="noopener">原文 ↗</a></div></div>'
    ).join('');

  document.getElementById('panel-memo').addEventListener('input', ev => setMark(sn, { m: ev.target.value }));

  // 開いた時点でこのサークルは既読
  const latest = posts[0].createdAt;
  if (!store.seen[sn] || latest > store.seen[sn]) { store.seen[sn] = latest; saveStore(); }

  document.getElementById('panel').hidden = false;
  document.getElementById('backdrop').hidden = false;
}

function closePanel() {
  document.getElementById('panel').hidden = true;
  document.getElementById('backdrop').hidden = true;
  render(); // 印やメモの変更をカードに反映
}

function bindToggle(container, set, isNumber) {
  container.addEventListener('click', ev => {
    const chip = ev.target.closest('.chip');
    if (!chip) return;
    const value = isNumber ? Number(chip.dataset.value) : chip.dataset.value;
    if (set.has(value)) set.delete(value); else set.add(value);
    chip.setAttribute('aria-pressed', String(set.has(value)));
    render();
  });
}

document.querySelector('.tabs').addEventListener('click', ev => {
  const tab = ev.target.closest('.tab');
  if (!tab) return;
  state.tab = tab.dataset.tab;
  for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', String(t === tab));
  render();
  if (state.tab === 'map') fitZoom();
});

document.getElementById('filter-toggle').addEventListener('click', ev => {
  const open = document.body.classList.toggle('filters-open');
  ev.currentTarget.setAttribute('aria-expanded', String(open));
});

document.getElementById('q').addEventListener('input', ev => {
  state.q = ev.target.value.trim().toLowerCase();
  render();
});

bindToggle(document.getElementById('day-filter'), state.days, true);
bindToggle(document.getElementById('area-filter'), state.areas, false);

document.getElementById('sort-toggle').addEventListener('click', ev => {
  state.sort = state.sort === 'space' ? 'newest' : 'space';
  ev.currentTarget.textContent = state.sort === 'space' ? '配置順' : '新着順';
  render();
});

document.getElementById('group-toggle').addEventListener('click', ev => {
  state.grouped = !state.grouped;
  ev.currentTarget.setAttribute('aria-pressed', String(state.grouped));
  render();
});

document.getElementById('media-only').addEventListener('click', ev => {
  state.mediaOnly = !state.mediaOnly;
  ev.currentTarget.setAttribute('aria-pressed', String(state.mediaOnly));
  render();
});

// --- 状態で絞る ---
document.getElementById('mark-filter').addEventListener('click', ev => {
  const chip = ev.target.closest('.chip');
  if (!chip) return;
  const v = chip.dataset.value;
  if (state.markFilter.has(v)) state.markFilter.delete(v); else state.markFilter.add(v);
  chip.setAttribute('aria-pressed', String(state.markFilter.has(v)));
  render();
});

// --- 購入で絞る(すべて → 未購入 → 購入済 の三段循環) ---
document.getElementById('buy-filter').addEventListener('click', ev => {
  state.buyFilter = state.buyFilter === 'all' ? 'todo' : state.buyFilter === 'todo' ? 'done' : 'all';
  ev.currentTarget.textContent = { all: '購入: すべて', todo: '未購入だけ', done: '購入済だけ' }[state.buyFilter];
  ev.currentTarget.setAttribute('aria-pressed', String(state.buyFilter !== 'all'));
  render();
});

document.querySelector('.viewpick').addEventListener('click', ev => {
  const b = ev.target.closest('.chip');
  if (!b) return;
  state.view = b.dataset.view;
  for (const c of document.querySelectorAll('.viewpick .chip')) c.setAttribute('aria-pressed', String(c === b));
  render();
});

document.getElementById('csv-btn').addEventListener('click', () =>
  download('c108-list.csv', buildCsv(), 'text/csv;charset=utf-8'));
document.getElementById('print-btn').addEventListener('click', printList);

// --- チェックの持ち出し / 読み込み(端末間の移動はファイルで。サーバは無い) ---
document.getElementById('export-btn').addEventListener('click', () =>
  download('c108-checklist.json', JSON.stringify({ marks: store.marks, seen: store.seen }, null, 1), 'application/json'));
document.getElementById('import-file').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    Object.assign(store.marks, data.marks || {});
    for (const [sn, at] of Object.entries(data.seen || {})) {
      if (!store.seen[sn] || at > store.seen[sn]) store.seen[sn] = at;
    }
    saveStore();
    render();
    document.getElementById('import-btn').textContent = '読み込みました ✓';
    setTimeout(() => { document.getElementById('import-btn').textContent = 'チェックを読み込む'; }, 2000);
  } catch (err) {
    alert('読み込めませんでした: ' + err.message);
  }
  ev.target.value = '';
});
document.getElementById('import-btn').addEventListener('click', () =>
  document.getElementById('import-file').click());

document.getElementById('read-all-btn').addEventListener('click', () => {
  for (const tab of ['circles', 'cosplayers', 'unclassified']) {
    for (const e of DATA[tab]) {
      if (!store.seen[e.screenName] || e.createdAt > store.seen[e.screenName]) store.seen[e.screenName] = e.createdAt;
    }
  }
  saveStore();
  render();
});

/** 印ボタンの共通処理。カード・表・パネルのどこから押しても同じ */
function handleMark(ev) {
  const mk = ev.target.closest('.mk');
  if (!mk) return false;
  const sn = mk.closest('[data-sn]').dataset.sn;
  const kind = mk.dataset.mk;
  const m = markOf(sn);
  if (kind === 'buy') setMark(sn, { b: !m.b });
  else setMark(sn, { s: m.s === kind ? undefined : kind });

  // パネルが開いていれば中のボタン表示も揃える
  const panel = document.getElementById('panel');
  if (!panel.hidden) {
    const row = panel.querySelector('.marks');
    if (row && row.dataset.sn === sn) row.outerHTML = marksHtml(sn);
  }
  if (mk.closest('#panel')) return true; // パネル内は再描画しない(メモ入力中に消えると困る)

  // 状態で絞り込んでいる時だけは、その項目が一覧から消える/現れるので描き直す。
  // それ以外は該当の 1 枚だけ差し替える —— 800 枚を毎回組み直すとクリックが 1 秒以上固まる。
  if (state.markFilter.size || state.buyFilter !== 'all') { render(); return true; }
  refreshEntry(sn);
  return true;
}

/** 印が付いた 1 件ぶんだけ、カード/行の見た目を更新する */
function refreshEntry(sn) {
  const m = markOf(sn);
  for (const el of document.querySelectorAll('[data-sn="' + CSS.escape(sn) + '"]')) {
    if (el.classList.contains('marks')) continue;
    if (m.s) el.dataset.mark = m.s; else delete el.dataset.mark;
    if (el.classList.contains('card')) {
      if (m.b) el.dataset.bought = 'true'; else delete el.dataset.bought;
    }
    const row = el.querySelector('.marks');
    if (row) row.outerHTML = marksHtml(sn);
    const st = el.querySelector('.st');
    if (st) st.textContent = (m.s ? MARK_ICON[m.s] : '') + (m.b ? '✓' : '');
  }
}

document.getElementById('panel').addEventListener('click', ev => { handleMark(ev); });
document.getElementById('panel').querySelector('.close').addEventListener('click', closePanel);
document.getElementById('backdrop').addEventListener('click', closePanel);
document.getElementById('ltable-wrap').addEventListener('click', ev => {
  if (handleMark(ev)) return;
  const row = ev.target.closest('tr[data-sn]');
  if (row) openPanel(row.dataset.sn);
});

document.getElementById('mapcanvas').addEventListener('click', ev => {
  const sp = ev.target.closest('.sp');
  if (sp) openPanel(sp.dataset.sn);
});

document.getElementById('zoom-in').addEventListener('click', () => applyZoom(zoom * 1.4));
document.getElementById('zoom-out').addEventListener('click', () => applyZoom(zoom / 1.4));
document.getElementById('zoom-fit').addEventListener('click', fitZoom);

/*
 * 指での操作。1 本指のドラッグは要素の overflow がそのままスクロールしてくれるので、
 * ここで面倒を見るのは 2 本指のつまみ操作だけ。
 * つまんだ中心が動かないようスクロール位置を補正しないと、拡大するたびに違う場所へ飛ぶ。
 */
const mapScroll = document.getElementById('mapscroll');
let pinch = null;

const touchDist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
const touchMid = t => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });

mapScroll.addEventListener('touchstart', ev => {
  if (ev.touches.length !== 2) return;
  const t = [ev.touches[0], ev.touches[1]];
  const mid = touchMid(t);
  const box = mapScroll.getBoundingClientRect();
  pinch = {
    dist: touchDist(t),
    zoom,
    // つまんだ点が中身のどこかを、今の倍率で覚えておく
    cx: (mapScroll.scrollLeft + mid.x - box.left) / zoom,
    cy: (mapScroll.scrollTop + mid.y - box.top) / zoom,
  };
}, { passive: true });

mapScroll.addEventListener('touchmove', ev => {
  if (!pinch || ev.touches.length !== 2) return;
  ev.preventDefault();
  const t = [ev.touches[0], ev.touches[1]];
  applyZoom(pinch.zoom * (touchDist(t) / pinch.dist));

  const mid = touchMid(t);
  const box = mapScroll.getBoundingClientRect();
  mapScroll.scrollLeft = pinch.cx * zoom - (mid.x - box.left);
  mapScroll.scrollTop = pinch.cy * zoom - (mid.y - box.top);
}, { passive: false });

mapScroll.addEventListener('touchend', ev => { if (ev.touches.length < 2) pinch = null; }, { passive: true });

// 素早く 2 回叩いたら拡大、拡大済みなら全体へ戻す
let lastTap = 0;
mapScroll.addEventListener('touchend', ev => {
  if (ev.touches.length || pinch) return;
  const now = Date.now();
  if (now - lastTap < 300) {
    if (ev.target.closest('.sp')) return; // スペースを開く操作を邪魔しない
    zoom > 1 ? fitZoom() : applyZoom(1.8);
  }
  lastTap = now;
}, { passive: true });

// 棟の絞り込み。押した棟だけを描き直し、全体に収める
document.getElementById('bldgbar').addEventListener('click', ev => {
  const btn = ev.target.closest('.chip');
  if (!btn) return;
  state.bldg = btn.dataset.bldg;
  for (const c of document.querySelectorAll('#bldgbar .chip')) {
    c.setAttribute('aria-pressed', String(c.dataset.bldg === state.bldg));
  }
  render();
  fitZoom();
});

const lightbox = document.getElementById('lightbox');
document.getElementById('grid').addEventListener('click', ev => {
  if (handleMark(ev)) return;
  if (ev.target.matches('.more')) {
    const body = ev.target.previousElementSibling;
    body.classList.toggle('open');
    ev.target.textContent = body.classList.contains('open') ? '折りたたむ' : '全文を表示';
    return;
  }
  if (ev.target.tagName === 'IMG') {
    lightbox.querySelector('img').src = ev.target.dataset.full;
    lightbox.classList.add('on');
    return;
  }
  if (ev.target.closest('a')) return;
  const card = ev.target.closest('.card[data-sn]');
  if (card) openPanel(card.dataset.sn);
});

// パネル内の画像もライトボックスで拡大できる
document.getElementById('panel').addEventListener('click', ev => {
  if (ev.target.tagName === 'IMG' && ev.target.dataset.full) {
    lightbox.querySelector('img').src = ev.target.dataset.full;
    lightbox.classList.add('on');
  }
});
lightbox.addEventListener('click', () => lightbox.classList.remove('on'));
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (lightbox.classList.contains('on')) { lightbox.classList.remove('on'); return; }
  if (!document.getElementById('panel').hidden) closePanel();
});

// 下端が近づいたら次のかたまりを足す
new IntersectionObserver(entries => {
  if (entries.some(e => e.isIntersecting)) appendChunk();
}, { rootMargin: '600px' }).observe(document.getElementById('more-sentinel'));

initSeen([...DATA.circles, ...DATA.cosplayers, ...DATA.unclassified]);
render();
fitZoom();
// フォントが差し替わると地図の実寸が数 px 変わる。落ち着いてからもう一度測って合わせ直す
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { if (state.tab === 'map') fitZoom(); });
}
addEventListener('resize', () => { if (state.tab === 'map') fitZoom(); });
`;

export function renderHtml(dataset: Dataset): string {
    const { stats, event, generatedAt } = dataset;
    const dayChips = event.days
        .map((d) => `<button class="chip" type="button" data-value="${d.day}" aria-pressed="false">${d.label}</button>`)
        .join('');
    // 地図の絞り込みは棟単位。会場でも「東は東、西は西」でしか動かない
    const bldgChips = buildingIds()
        .map((id) => `<button class="chip" type="button" data-bldg="${id}" aria-pressed="false">${id}</button>`)
        .join('');

    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${event.name} 情報まとめ</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="head">
    <div class="eyebrow">2026.08.15 – 08.16 · 東京ビッグサイト</div>
    <h1>${event.name} 情報まとめ</h1>
    <div class="summary">
      <div class="stat"><b id="stat-circles">${stats.circles}</b><span>サークル</span></div>
      <div class="stat"><b id="stat-cosplayers">${stats.cosplayers}</b><span>コスプレイヤー</span></div>
      <div class="stat"><b id="stat-unclassified">${stats.unclassified}</b><span>未分類</span></div>
      <div class="stat"><b>${stats.tweets}</b><span>ツイートから</span></div>
    </div>
    <div class="gen">生成 ${new Date(generatedAt).toLocaleString('ja-JP')}${stats.overridesApplied ? ` · 人工修正 ${stats.overridesApplied} 件適用` : ''}</div>
  </header>

  <nav class="tabs" role="tablist">
    <button class="tab" type="button" role="tab" data-tab="map" aria-selected="true">地図</button>
    <button class="tab" type="button" role="tab" data-tab="circles" aria-selected="false">サークル<span class="n">${stats.circles}</span></button>
    <button class="tab" type="button" role="tab" data-tab="cosplayers" aria-selected="false">コスプレイヤー<span class="n">${stats.cosplayers}</span></button>
    <button class="tab" type="button" role="tab" data-tab="unclassified" aria-selected="false">未分類<span class="n">${stats.unclassified}</span></button>
  </nav>

  <div class="toolbar">
    <input id="q" type="search" placeholder="サークル名 / 作者 / キャラ / 作品 / 本文 を検索">
    <button class="chip" type="button" id="filter-toggle" aria-expanded="false">絞り込み</button>
    <div class="chips" id="day-filter">${dayChips}</div>
    <div class="chips" id="area-filter">
      <button class="chip" type="button" data-value="東" aria-pressed="false">東</button>
      <button class="chip" type="button" data-value="西" aria-pressed="false">西</button>
      <button class="chip" type="button" data-value="南" aria-pressed="false">南</button>
    </div>
    <div class="chips" id="mark-filter">
      <button class="chip" type="button" data-value="must" aria-pressed="false">★絶対</button>
      <button class="chip" type="button" data-value="like" aria-pressed="false">♡気になる</button>
    </div>
    <div class="chips">
      <button class="chip" type="button" id="buy-filter" aria-pressed="false">購入: すべて</button>
      <button class="chip" type="button" id="sort-toggle" data-sort="space">配置順</button>
      <button class="chip" type="button" id="group-toggle" aria-pressed="true">サークル単位</button>
      <button class="chip" type="button" id="media-only" aria-pressed="false">画像あり</button>
    </div>
    <span class="count" id="count"></span>
  </div>

  <div class="toolbar2">
    <div class="chips viewpick">
      <button class="chip" type="button" data-view="cards" aria-pressed="true">カード</button>
      <button class="chip" type="button" data-view="table" aria-pressed="false">表</button>
    </div>
    <span class="spacer"></span>
    <button class="chip" type="button" id="csv-btn" title="今の絞り込み・並び順で書き出します">CSV</button>
    <button class="chip" type="button" id="print-btn" title="今の絞り込み・並び順で印刷します">印刷</button>
    <button class="chip" type="button" id="export-btn" title="チェック・メモをファイルに書き出して別の端末へ">チェックを書き出す</button>
    <button class="chip" type="button" id="import-btn">チェックを読み込む</button>
    <input type="file" id="import-file" accept="application/json" hidden>
    <button class="chip" type="button" id="read-all-btn" title="「新着」の印をすべて消します">すべて既読にする</button>
  </div>

  <div class="mapwrap" id="mapwrap">
    <div class="bldgbar" id="bldgbar">
      <button class="chip" type="button" data-bldg="" aria-pressed="true">全体</button>
      ${bldgChips}
    </div>
    <div class="mapbar">
      <span class="note">公式配置図のホール構成に沿った地図です。通路や島の細かな位置までは再現していません —
        正確な配置は <a href="https://webcatalog.circle.ms/" target="_blank" rel="noopener">コミケWebカタログ</a> で確認してください</span>
      <div class="zoom">
        <button class="zbtn" type="button" id="zoom-out" aria-label="縮小">−</button>
        <button class="zbtn" type="button" id="zoom-in" aria-label="拡大">＋</button>
        <button class="zbtn wide" type="button" id="zoom-fit">全体</button>
        <span id="zoomlabel">100%</span>
      </div>
    </div>
    <div class="mapscroll" id="mapscroll"><div class="mapsizer" id="mapsizer"><div class="mapcanvas" id="mapcanvas" data-detail="1"></div></div></div>
  </div>

  <div class="grid" id="grid"></div>
  <div id="more-sentinel" hidden></div>
  <div class="ltable-wrap" id="ltable-wrap" hidden></div>
  <div class="empty" id="empty" hidden>条件に合う項目がありません</div>

  <footer class="site-note">
    非公式のファンメイドツールです。コミックマーケット準備会および各サークルとは一切関係ありません。
    配置・頒布情報は X の投稿から機械的に抽出したもので、正確性は保証されません —
    必ず <a href="https://webcatalog.circle.ms/" target="_blank" rel="noopener">公式Webカタログ</a> 等でご確認ください。
    画像・本文の権利は各投稿者に帰属します。当ページは X 上の原ツイートを参照表示するだけで保存はしておらず、
    原ツイートが削除されると表示されなくなります。
    チェック・メモはお使いのブラウザ内(localStorage)にのみ保存され、どこにも送信されません。
  </footer>
</div>

<aside id="panel" hidden>
  <button class="close" type="button" aria-label="閉じる">✕</button>
  <div id="panel-body"></div>
</aside>
<div id="backdrop" hidden></div>
<div id="printtable"></div>

<div id="lightbox"><img alt=""></div>

<script type="application/json" id="c108-data">${embedJson(dataset)}</script>
<script>${JS.replace('__FLOOR__', JSON.stringify(FLOOR)).replace('__HALL_OF__', JSON.stringify(buildHallLookup())).replace('__BLOCK_OF__', JSON.stringify(buildBlockLookup()))}</script>
</body>
</html>
`;
}
