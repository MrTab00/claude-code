/**
 * 单文件 HTML 模板。数据以 JSON 内嵌, CSS/JS 全内联, 零外部依赖。
 * 双击即开, 也能直接发给别人。
 *
 * 配色は東/西/南の地区色でコード化している —— 会場で探すときに効くのは地区なので、
 * 装飾ではなく情報として色を使う。配置番号は等幅 + tabular-nums でカタログの表記に寄せる。
 */

import type { Dataset } from '../types';
import { FLOOR, buildBlockLookup, buildHallLookup, buildingIds, companyNames } from './venue';

/** 属性値に入れる文字列。クォートが混ざると属性がそこで切れる */
function attr(s: string): string {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

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
  --paper: #0c1017;
  --surface: #151b25;
  --surface-2: #1c2331;
  --border: #2a3444;
  --ink: #e9edf4;
  --muted: #8e9bb0;
  --accent: #ff5c93;
  --accent-ink: #24030f;
  --accent-soft: #33141f;
  --east: #62a0ff;
  --east-soft: #14243c;
  --west: #3ecfae;
  --west-soft: #0e2f2a;
  --south: #ffa257;
  --south-soft: #34220f;
  --flag: #ffbe5c;
  --flag-soft: #332612;
  --sheet: #10161f;
  --island: #253040;
  --shadow: 0 1px 2px rgba(0,0,0,.5), 0 8px 26px rgba(0,0,0,.42);
  --ring: rgba(255,92,147,.5);
  --scrim: rgba(3,6,11,.66);
  --glass: rgba(21,27,37,.84);
`;

const CSS = `
:root {
  color-scheme: light dark;
  --paper: #eef1f7;
  --surface: #ffffff;
  --surface-2: #f4f6fb;
  --border: #dde2ec;
  --ink: #121824;
  --muted: #66718a;
  --accent: #e11e63;
  --accent-ink: #ffffff;
  --accent-soft: #ffe6ef;
  --east: #2563eb;
  --east-soft: #e5edff;
  --west: #0d9488;
  --west-soft: #ddf5f1;
  --south: #ea580c;
  --south-soft: #ffece0;
  --flag: #a35a00;
  --flag-soft: #fff0dc;
  --sheet: #dde4ef;
  --island: #ccd4e2;
  --shadow: 0 1px 2px rgba(18,24,36,.06), 0 6px 20px rgba(18,24,36,.07);
  --ring: rgba(225,30,99,.45);
  --scrim: rgba(12,16,23,.5);
  /* 地図の上に浮かせる面。下の会場が透けるだけの濃さにする */
  --glass: rgba(255,255,255,.86);

  /* 角の丸み。触る前提なので、指で押す面はどれも丸く大きく取る */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 18px;
  --r-pill: 999px;
  /* 指で押せる最小の高さ。ここを下回るボタンは作らない */
  --tap: 44px;

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
  /*
   * 指で押したときの青いハイライトと、行き過ぎたスクロールの跳ね返りは
   * 「web ページを見ている」感じを出してしまう。道具として使うので消す。
   */
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior-y: none;
}
/* 押す物はどれも押した瞬間に反応させる。300ms の待ちが入るとページに見える */
button, a, input, select, textarea, summary { touch-action: manipulation; }
button:active, .chip:active, .tab:active, .prow:active { transform: scale(.97); }
button, .chip, .tab, .prow { transition: transform .08s ease, background-color .12s ease, color .12s ease, border-color .12s ease; }
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; border-radius: var(--r-sm); }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }

.wrap { max-width: 1240px; margin: 0 auto; padding: 24px 16px 72px; display: flex; flex-direction: column; gap: 18px; }

/* --- ヘッダ: 概況を明細より先に --- */
.head { display: flex; flex-direction: column; gap: 12px; }
.eyebrow {
  display: inline-flex; align-self: flex-start; align-items: center; gap: 7px;
  font: 700 11px/1 var(--sans); letter-spacing: .16em; text-transform: uppercase;
  color: var(--accent-ink); background: var(--accent);
  padding: 6px 12px; border-radius: var(--r-pill);
}
.head h1 { font-size: 30px; line-height: 1.2; margin: 0; text-wrap: balance; letter-spacing: -.025em; font-weight: 800; }
/*
 * 概況は「文の中の数字」ではなく数字そのものを見せる。会場に着いてから
 * 見るのは番号と数なので、書体も大きさもそちらに寄せる。
 */
.summary { display: flex; flex-wrap: wrap; gap: 8px; align-items: stretch; }
.stat {
  display: flex; flex-direction: column; gap: 1px;
  padding: 9px 14px; border-radius: var(--r-md);
  background: var(--surface); border: 1px solid var(--border);
}
.stat b { font: 700 21px/1.15 var(--mono); font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.stat span { font-size: 11.5px; color: var(--muted); letter-spacing: .02em; }
.gen { font-size: 12px; color: var(--muted); }

/* --- タブ: 下線ではなく、まとまりごと押せる帯にする --- */
.tabs {
  display: flex; gap: 4px; flex-wrap: wrap; align-self: flex-start; max-width: 100%;
  padding: 4px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-pill);
}
.tab {
  appearance: none; border: 0; background: none; color: var(--muted);
  font: 600 14.5px var(--sans); cursor: pointer;
  padding: 9px 16px; border-radius: var(--r-pill); min-height: 38px;
}
.tab:hover { color: var(--ink); }
.tab[aria-selected="true"] { color: var(--accent-ink); background: var(--accent); box-shadow: var(--shadow); }
.tab .n { font: 700 12px var(--mono); font-variant-numeric: tabular-nums; margin-left: 7px; opacity: .8; }

/* --- ツールバー --- */
.toolbar {
  position: sticky; top: 0; z-index: 20;
  display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
  padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
  box-shadow: var(--shadow);
}
.toolbar input[type=search] {
  flex: 1 1 250px; min-width: 0; padding: 10px 14px; min-height: var(--tap);
  font: 15px var(--sans); color: var(--ink);
  border: 1px solid var(--border); border-radius: var(--r-pill); background: var(--surface-2);
}
.toolbar input[type=search]::placeholder { color: var(--muted); }
.chips { display: flex; gap: 5px; flex-wrap: wrap; }
.chip {
  appearance: none; padding: 7px 13px; border-radius: var(--r-pill);
  border: 1px solid var(--border); background: var(--surface-2); color: var(--muted);
  font: 600 13px var(--sans); cursor: pointer;
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
  appearance: none; min-width: var(--tap); height: var(--tap); border: 1px solid var(--border); border-radius: var(--r-pill);
  background: var(--surface); color: var(--ink); cursor: pointer; font: 600 19px var(--sans); line-height: 1;
  box-shadow: var(--shadow); touch-action: manipulation;
}
.zbtn.wide { padding: 0 16px; font-size: 13px; font-weight: 600; }
.mapscroll {
  overflow: auto; background: var(--sheet); border: 1px solid var(--border); border-radius: var(--r-lg);
  /* 縮小して余りが出たら中央に置く。左上に貼り付いていると会場が端に寄って見える */
  display: grid; place-content: safe center;
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
.mapsizer { position: relative; margin: auto; }
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
 * 企業ブース。ブロック記号が無く番号だけなので、島ではなく番号のまとまりで並べる。
 * 番号は飛び飛び(1111 の次が 1121)なので連番のマスは作らず、実在する番号だけ置く。
 */
/* 伸ばさない。親が縦に広いと、マスがその高さいっぱいまで引き伸ばされてしまう */
.cgroups { --cbw: calc(var(--sw) * 3.4); display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
.cgroup { display: flex; flex-direction: column; gap: 3px; }
.cgroup > .glabel { font: 700 9px var(--sans); color: var(--muted); }
/* 配置図の企業ブースは横長。折り返しを狭くすると縦に伸びて全体表示が小さくなる */
/*
 * grid にしてある。flex-wrap だと行の高さが揃えられてマスが縦に伸び、
 * 配置図と似ても似つかない縦長の箱になる。grid の行は中身の高さに合う。
 */
.cbooths {
  display: grid; gap: 3px; align-content: start; justify-content: start;
  grid-template-columns: repeat(auto-fill, var(--cbw));
  width: calc((var(--cbw) + 3px) * 5);
}
.cb {
  appearance: none; border: 1px solid var(--border); border-radius: 2px; padding: 1px 3px; margin: 0;
  /* align-self を明示しないと grid の行いっぱいに引き伸ばされ、縦長の箱になる */
  align-self: start; width: var(--cbw); height: calc(var(--sh) * 3.4); overflow: hidden;
  background: var(--island); color: var(--muted); cursor: pointer;
  font: 600 7px/1.25 var(--sans); display: flex; flex-direction: column; align-items: flex-start;
  touch-action: manipulation;
}
.cb.vacant { cursor: default; }
.cb .num { font-variant-numeric: tabular-nums; opacity: .7; }
/* 出展社名は既定で出す。長いものは 2 行まで見せて、あとは切る */
.cb .nm { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cb:not(.vacant) { background: var(--west-soft); color: var(--west); border-color: var(--west); }
.cb:not(.vacant)[data-area="南"] { background: var(--south-soft); color: var(--south); border-color: var(--south); }
.cb[data-mark="must"] { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
.cb[data-mark="like"] { border-width: 2px; }
.cb[data-mark="skip"] { opacity: .35; }
/* 拡大したらサークル名も出す。縮小時は番号すら読めないので枠だけ */
.mapcanvas[data-detail="2"] .cb .nm { display: block; }
/* 出展社名は等倍でも読める。縮小しきったときだけ番号も消して枠だけにする */
.mapcanvas[data-detail="0"] .cgroups { --cbw: calc(var(--sw) * 1.2); }
.mapcanvas[data-detail="0"] .cb { font-size: 0; padding: 0; height: var(--sh); }
.mapcanvas[data-detail="0"] .cb .nm { display: none; }
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

/* --- プラン: 印を付けたサークルを当日まわる順に --- */
.planwrap { display: flex; flex-direction: column; gap: 18px; }
.plansum { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.plansum .pill { font: 700 13px var(--sans); padding: 5px 11px; border-radius: 999px; }
.plansum .pill.must { background: var(--accent); color: var(--accent-ink); }
.plansum .pill.like { background: var(--accent-soft); color: var(--accent); }
.plansum .pnote { font-size: 12px; color: var(--muted); }

.pgroup { display: flex; flex-direction: column; gap: 6px; }
.pgroup > h3 {
  margin: 0; display: flex; align-items: center; gap: 8px;
  font: 700 13px var(--sans); color: var(--ink);
  position: sticky; top: 0; z-index: 1; background: var(--paper); padding: 6px 0;
}
.pgroup .parea { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: var(--r-pill); background: var(--surface-2); }
.pgroup .parea[data-area="東"] { color: var(--east); background: var(--east-soft); }
.pgroup .parea[data-area="西"] { color: var(--west); background: var(--west-soft); }
.pgroup .parea[data-area="南"] { color: var(--south); background: var(--south-soft); }
.pgroup .pn { margin-left: auto; font: 500 12px var(--mono); color: var(--muted); }

.plist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
/*
 * 1 行 = 1 サークル。会場では歩きながら片手で見るので、
 * 押せる高さ(52px)と、配置番号が数字として揃うことを優先する。
 */
.prow {
  appearance: none; width: 100%; min-height: 58px; cursor: pointer; text-align: left;
  display: flex; align-items: center; gap: 11px; padding: 9px 13px;
  border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); color: var(--ink);
  font: inherit; touch-action: manipulation;
}
.prow:hover { border-color: var(--accent); }
.prow .pmark { font-size: 15px; line-height: 1; flex: none; width: 18px; text-align: center; }
.prow .pmark.must { color: var(--accent); }
.prow .pmark.like { color: var(--accent); opacity: .65; }
.prow .pspace {
  font: 700 13.5px var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap;
  padding: 5px 9px; border-radius: var(--r-sm); background: var(--surface-2); flex: none;
}
.prow .pspace[data-area="東"] { color: var(--east); background: var(--east-soft); }
.prow .pspace[data-area="西"] { color: var(--west); background: var(--west-soft); }
.prow .pspace[data-area="南"] { color: var(--south); background: var(--south-soft); }
.prow .pname { flex: 1; min-width: 0; font-size: 14px; display: flex; flex-direction: column; gap: 2px; }
.prow .pmemo { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prow .pdone { flex: none; font: 700 11px var(--sans); color: var(--west); }
.planwrap .empty { text-align: center; color: var(--muted); padding: 48px 16px; font-size: 14px; line-height: 1.9; }

/* --- カード --- */
.grid { display: grid; gap: 13px; grid-template-columns: repeat(auto-fill, minmax(322px, 1fr)); }
.card {
  position: relative; overflow: hidden;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 15px 16px 14px 20px; box-shadow: var(--shadow);
  display: flex; flex-direction: column; gap: 9px;
}
/* 左の縦帯で地区を示す: 会場で探すとき効くのは地区なので、色は装飾ではなく情報 */
.card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--border); }
.card[data-area="東"]::before { background: var(--east); }
.card[data-area="西"]::before { background: var(--west); }
.card[data-area="南"]::before { background: var(--south); }

.booth { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.b {
  font: 700 15.5px var(--mono); font-variant-numeric: tabular-nums; letter-spacing: -.01em;
  padding: 5px 10px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--border);
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
.tag { font-size: 12px; padding: 4px 10px; border-radius: var(--r-pill); background: var(--surface-2); border: 1px solid var(--border); }
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
  width: 100%; aspect-ratio: 1; object-fit: contain; border-radius: var(--r-md);
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
.flag { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: var(--r-pill); background: var(--flag-soft); color: var(--flag); }

#more-sentinel { height: 1px; }
.empty { text-align: center; color: var(--muted); padding: 64px 16px; font-size: 14px; }

#lightbox {
  position: fixed; inset: 0; background: rgba(6,9,14,.92); display: none;
  align-items: center; justify-content: center; z-index: 60; cursor: zoom-out; padding: 24px;
}
#lightbox.on { display: flex; }
#lightbox img { max-width: 100%; max-height: 100%; border-radius: 8px; }

/* --- チェック状態 --- */
.marks { display: flex; gap: 4px; flex-wrap: wrap; }
.mk {
  appearance: none; cursor: pointer; font: 600 12.5px var(--sans);
  padding: 6px 12px; border-radius: var(--r-pill); border: 1px solid var(--border);
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
.ltable-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow); }
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
#backdrop { position: fixed; inset: 0; background: var(--scrim); z-index: 40; -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); }
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
  width: 100%; min-height: 72px; resize: vertical; font: 14px/1.6 var(--sans);
  color: var(--ink); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 10px 12px;
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
/* 言語の切り替え。ネイティブの select にしてある —— スマホでは OS の選択 UI が出て一番早い */
.langpick {
  appearance: none; flex: none; cursor: pointer;
  padding: 7px 13px; min-height: var(--tap); border-radius: var(--r-pill);
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink);
  font: 600 13px var(--sans);
}
/* 取っ手(シートをつまんで下げる帯)はスマホ表示だけ。既定では出さない */
#panel .grab { display: none; }

/* --- 手のひらで使う前提の調整 --- */
/*
 * スマホは「ページ」ではなく「アプリ」として組む。
 *
 * 会場で片手で使うのが本番。ページとして縦に積むと、主役の地図が上の見出しに
 * 押し下げられ、タブは指の届かない画面上端に残る。そこで:
 *   - 画面の高さに固定し、ページ自体はスクロールさせない
 *   - タブは下端へ(親指の届く範囲)
 *   - 地図は間を全部使い、端まで広げる。操作は 2 本指のつまみが主
 *   - 詳細は下から出るシートにして、下へ払うと閉じる
 */
@media (max-width: 720px) {
  html { height: 100%; }
  body { height: 100%; font-size: 15px; }
  /* 地図・プランは画面に貼り付ける。一覧タブだけは普通に縦スクロールさせる */
  body.app { overflow: hidden; overscroll-behavior: none; }
  body.app .wrap { height: 100dvh; }

  /* position: relative は、地図タブで操作列を浮かせるときの基準になる */
  .wrap { position: relative; padding: 0; gap: 0; max-width: none; display: flex; flex-direction: column; min-height: 100dvh; }
  .head { padding: 12px 14px 6px; gap: 0; }
  .summary, .gen, .head .eyebrow { display: none; }
  .head h1 { font-size: 16px; line-height: 1.3; font-weight: 700; }

  /* --- 下端のタブバー --- */
  /*
   * 広い画面では丸い帯にまとめたタブだが、下端のバーではそれを解く。
   * 選んだところを塗り潰すと親指の下が一面の色になってしまうので、
   * ここでは字の色と上の細い線で示す。
   */
  .tabs {
    order: 99; margin-top: auto; position: sticky; bottom: 0; z-index: 30;
    align-self: stretch; max-width: none;
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
    border: 0; border-top: 1px solid var(--border); border-radius: 0;
    background: var(--surface); padding: 0 0 env(safe-area-inset-bottom);
    box-shadow: 0 -1px 14px rgba(12,16,23,.07);
  }
  /* 件数は名前の下に置く。横に並べると「コスプレイヤー」で桁が押し出される */
  .tab {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1px; min-height: 56px; padding: 9px 4px;
    font-size: 12px; font-weight: 600; border-radius: 0; white-space: nowrap;
  }
  .tab[aria-selected="true"] {
    background: none; color: var(--accent);
    box-shadow: inset 0 2.5px 0 var(--accent);
  }
  .tab .n { margin-left: 0; font-size: 11px; }

  /* --- 上のツールバー類。畳めるものは畳む --- */
  #filter-toggle { display: inline-flex; align-items: center; }
  body:not(.filters-open) .toolbar > .chips,
  body:not(.filters-open) .count,
  body:not(.filters-open) .toolbar2 { display: none; }
  .toolbar { position: static; padding: 8px; gap: 7px; margin: 0 10px; border-radius: var(--r-lg); }
  .toolbar2 { margin: 0 10px; }
  /* 16px 未満だと iOS が勝手に拡大する。基準幅は小さくして「絞り込み」と 1 行に収める */
  .toolbar input[type=search] { flex: 1 1 120px; min-height: 46px; font-size: 16px; }
  .count { margin-left: 0; width: 100%; text-align: right; }

  /* 棟のチップとタブは折り返さず横スクロール。折り返すとそのぶん地図が短くなる */
  .bldgbar { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding: 8px 10px 4px; }
  .bldgbar::-webkit-scrollbar { display: none; }
  .bldgbar > .chip { flex: none; white-space: nowrap; }
  .chip { padding: 10px 13px; font-size: 14px; min-height: 44px; }
  .mk { padding: 10px 12px; font-size: 13px; min-height: 44px; }

  /*
   * --- 地図タブ: 操作するものは地図の「上に積む」のではなく「上に浮かせる」 ---
   *
   * 積むと、検索欄と棟のチップだけで画面の 2 割を先に取ってしまい、
   * 残りに会場を収めるので全体表示が読めない大きさまで縮む。
   * 浮かせれば地図はタブバーまでの全部を使える。
   *
   * 「一番上まで滑らせたら出す」方式は採らなかった。全体表示では地図が
   * 中央に収まっていてスクロール自体が起きない —— 一番縮んでいて棟を
   * 選びたいときに限って、出すきっかけが無くなる。
   */
  body.app.tab-map .head { display: none; }
  body.app.tab-map .toolbar,
  body.app.tab-map .bldgbar {
    position: absolute; left: 0; right: 0; z-index: 12;
    transition: opacity .18s ease, transform .18s ease;
  }
  body.app.tab-map .toolbar {
    top: calc(8px + env(safe-area-inset-top)); margin: 0 10px;
    background: var(--glass); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  }
  body.app.tab-map .bldgbar { top: calc(66px + env(safe-area-inset-top)); padding: 4px 10px; }
  /* チップ自体が面を持っているので、帯には背景を敷かない */
  body.app.tab-map .bldgbar > .chip { box-shadow: var(--shadow); }
  /* 絞り込みを開いている間は下の列が伸びるので、チップの帯を押し下げる */
  body.app.tab-map.filters-open .bldgbar { top: calc(122px + env(safe-area-inset-top)); }
  /* 指で地図を動かしている間は引っ込む。指の下の会場を隠さないため */
  body.app.tab-map .toolbar.away,
  body.app.tab-map .bldgbar.away { opacity: .12; transform: translateY(-6px); pointer-events: none; }

  /* --- 地図は端まで。操作はつまみが主 --- */
  .mapwrap { position: relative; flex: 1; min-height: 0; }
  body.app .mapscroll { height: 100%; flex: 1; }
  /*
   * プランでは主役は一覧。地図に画面いっぱい使わせると一覧がタブバーの下に隠れ、
   * 「印を付けた店を順に見る」という本来の使い方ができない。
   */
  body.app.tab-plan .mapwrap { flex: none; height: 34dvh; }
  body.app.tab-plan .planwrap { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .mapscroll { border-left: 0; border-right: 0; border-radius: 0; }
  .mapbar { position: absolute; right: 10px; bottom: 12px; z-index: 5; padding: 0; width: auto; }
  .mapbar .note { display: none; }
  .mapbar .zoom {
    flex-direction: column; gap: 2px; padding: 4px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-pill);
    box-shadow: 0 2px 6px rgba(12,16,23,.1), 0 10px 28px rgba(12,16,23,.14);
  }
  .mapbar .zoom span { display: none; }
  .zbtn { min-width: 44px; height: 44px; border: 0; box-shadow: none; }
  .zbtn.wide { font-size: 11px; height: 44px; padding: 0; }

  /* --- 詳細は下から出るシート --- */
  #panel {
    top: auto; left: 0; right: 0; bottom: 0; width: 100%;
    height: min(86dvh, 720px); border-left: 0; border-top: 1px solid var(--border);
    border-radius: 24px 24px 0 0; padding: 8px 16px calc(16px + env(safe-area-inset-bottom));
    box-shadow: 0 -8px 44px rgba(12,16,23,.22);
    touch-action: pan-y;
  }
  /* つまんで下げるための取っ手。押せる場所がここだと目で分かるようにする */
  #panel .grab {
    display: block; width: 44px; height: 5px; border-radius: var(--r-pill); background: var(--border);
    margin: 3px auto 10px; flex: none;
  }
  #panel .close { top: 6px; right: 10px; width: 44px; height: 44px; font-size: 22px; }
  #panel h2 { font-size: 18px; }

  /* --- 一覧 --- */
  .grid { grid-template-columns: 1fr; padding: 0 10px; }
  .planwrap { padding: 0 10px 16px; }
  .ltable th, .ltable td { padding: 10px 8px; }
  .pgroup > h3 { font-size: 12.5px; background: var(--paper); }
  .card { border-radius: var(--r-md); }
  .prow { padding: 10px; gap: 8px; min-height: 56px; }
  .prow .pspace { font-size: 13px; padding: 4px 7px; }
  /*
   * 断り書きは一覧タブに常に出ている。地図・プランは画面に貼り付けているので、
   * ここに置くとそのぶん地図が短くなるだけ。アプリ表示のときだけ外す。
   */
  body.app .site-note { display: none; }
  .site-note { padding: 0 12px 12px; }
}
`;

const JS = String.raw`
const DATA = JSON.parse(document.getElementById('c108-data').textContent);

/*
 * --- 表示言語 ---
 *
 * 訳すのは画面の言葉だけ。ツイート本文・サークル名・作品名はそのまま出す ——
 * 集めてきた元の文であって、こちらが書き換えていいものではない。
 *
 * 配置番号(東1 ア-22a, 企業ブースの 4 桁)も訳さない。会場で見上げる看板と
 * 一字一句同じでないと、現地で突き合わせられなくなる。地区の「東・西・南」も同じ理由で漢字のまま。
 */
const I18N = {
  ja: {
    'title':        '{event} 情報まとめ',
    'eyebrow':      '2026.08.15 – 08.16 · 東京ビッグサイト',
    'stat.circles': 'サークル', 'stat.cosplayers': 'コスプレイヤー', 'stat.tweets': 'ツイートから',
    'gen':          '生成 {when}', 'gen.overrides': ' · 人工修正 {n} 件適用',
    'tab.map': '地図', 'tab.plan': 'プラン', 'tab.circles': 'サークル', 'tab.cosplayers': 'コスプレイヤー',
    'search':       'サークル名 / 作者 / キャラ / 作品 / 本文 を検索',
    'filters':      '絞り込み',
    'mark.must': '★絶対', 'mark.like': '♡気になる', 'mark.skip': '⊖見送り', 'mark.buy': '✓購入済',
    'buy.all': '購入: すべて', 'buy.todo': '未購入だけ', 'buy.done': '購入済だけ',
    'sort.space': '配置順', 'sort.new': '新着順',
    'group':        'サークル単位',
    'media':        '画像あり',
    'count':        '{n} / {all} {unit}', 'unit.group': '組', 'unit.item': '件',
    'view.cards': 'カード', 'view.table': '表',
    'print':        '印刷',      'print.t':  '今の絞り込み・並び順で印刷します',
    'csv.t':        '今の絞り込み・並び順で書き出します',
    'export':       'チェックを書き出す', 'export.t': 'チェック・メモをファイルに書き出して別の端末へ',
    'import':       'チェックを読み込む', 'import.ok': '読み込みました ✓', 'import.ng': '読み込めませんでした: {err}',
    'readall':      'すべて既読にする',   'readall.t': '「新着」の印をすべて消します',
    'bldg.all':     '全体',
    'map.note':     '公式配置図のホール構成に沿った地図です。通路や島の細かな位置までは再現していません — 正確な配置は',
    'map.note.link': 'コミケWebカタログ',
    'map.note.end': ' で確認してください',
    'zoom.out': '縮小', 'zoom.in': '拡大', 'zoom.fit': '全体',
    'map.stray':    '構成表に無いブロック',
    'plan.empty':   'まだ印がありません。',
    'plan.empty2':  'サークル一覧や地図でカードを開いて <b>★絶対</b> か <b>♡気になる</b> を付けると、ここに並びます。',
    'plan.note':    '{n} サークル · 地図はこの印だけを表示しています',
    'plan.done':    '済',
    'day.n':        '{n}日目', 'day.unknown': '日程不明',
    'area.suffix':  '地区', 'space.unknown': '配置不明',
    'new':          '新着',
    'more':         '全文を表示', 'less': '折りたたむ',
    'source':       '原文',
    'memo':         'メモ', 'memo.ph': '新刊あり / 無配欲しい / 時間あれば 等',
    'posts':        '投稿 ({n})',
    'close':        '閉じる',
    'empty':        '条件に合う項目がありません',
    'th.state': '状態', 'th.space': '配置', 'th.circle': 'サークル', 'th.price': '金額', 'th.memo': 'メモ',
    'csv.day': '日程', 'csv.name': 'サークル名', 'csv.account': 'アカウント', 'csv.works': '作品・キャラ', 'csv.bought': '購入済',
    'guess.name': '推定', 'guess.name.t': 'サークル名は推定です',
    'guess.char': 'キャラ推定', 'guess.char.t': '本文からの推定です',
    'has.shinagaki': 'お品書きあり', 'dual': 'サークル兼レイヤー', 'posts.merged': '{n} 投稿をまとめて表示',
    'src.name': '表示名', 'src.bio': 'プロフィール', 'src.account': '別ツイート',
    'note.1': '非公式のファンメイドツールです。コミックマーケット準備会および各サークルとは一切関係ありません。配置・頒布情報は X の投稿から機械的に抽出したもので、正確性は保証されません — 必ず',
    'note.2': '等でご確認ください。画像・本文の権利は各投稿者に帰属します。当ページは X 上の原ツイートを参照表示するだけで保存はしておらず、原ツイートが削除されると表示されなくなります。チェック・メモはお使いのブラウザ内(localStorage)にのみ保存され、どこにも送信されません。',
    'note.link': '公式Webカタログ',
  },
  zh: {
    'title':        '{event} 摊位情报汇总',
    'eyebrow':      '2026.08.15 – 08.16 · 东京 Big Sight',
    'stat.circles': '社团', 'stat.cosplayers': 'Coser', 'stat.tweets': '条推文',
    'gen':          '生成于 {when}', 'gen.overrides': ' · 已应用 {n} 条人工修正',
    'tab.map': '地图', 'tab.plan': '计划', 'tab.circles': '社团', 'tab.cosplayers': 'Coser',
    'search':       '搜索社团名 / 作者 / 角色 / 作品 / 正文',
    'filters':      '筛选',
    'mark.must': '★必去', 'mark.like': '♡想去', 'mark.skip': '⊖略过', 'mark.buy': '✓已买',
    'buy.all': '购买: 全部', 'buy.todo': '只看未买', 'buy.done': '只看已买',
    'sort.space': '按摊位号', 'sort.new': '按时间',
    'group':        '按社团合并',
    'media':        '有图',
    'count':        '{n} / {all} {unit}', 'unit.group': '组', 'unit.item': '条',
    'view.cards': '卡片', 'view.table': '表格',
    'print':        '打印',      'print.t':  '按当前筛选和排序打印',
    'csv.t':        '按当前筛选和排序导出',
    'export':       '导出勾选', 'export.t': '把勾选和备注存成文件，带到别的设备',
    'import':       '导入勾选', 'import.ok': '已导入 ✓', 'import.ng': '导入失败: {err}',
    'readall':      '全部标为已读', 'readall.t': '清掉所有「新」标记',
    'bldg.all':     '全部',
    'map.note':     '按官方配置图的展馆结构绘制。通道和岛的细节位置没有还原 — 准确配置请查',
    'map.note.link': 'Comiket Web Catalog',
    'map.note.end': '',
    'zoom.out': '缩小', 'zoom.in': '放大', 'zoom.fit': '全部',
    'map.stray':    '不在配置表里的区块',
    'plan.empty':   '还没有标记。',
    'plan.empty2':  '在社团列表或地图上打开卡片，标记 <b>★必去</b> 或 <b>♡想去</b>，就会出现在这里。',
    'plan.note':    '{n} 个社团 · 地图上只显示这些标记',
    'plan.done':    '已买',
    'day.n':        '第{n}天', 'day.unknown': '日期不明',
    'area.suffix':  '区', 'space.unknown': '摊位不明',
    'new':          '新',
    'more':         '展开全文', 'less': '收起',
    'source':       '原推文',
    'memo':         '备注', 'memo.ph': '有新刊 / 想要无料 / 有时间再去 等',
    'posts':        '推文 ({n})',
    'close':        '关闭',
    'empty':        '没有符合条件的项目',
    'th.state': '标记', 'th.space': '摊位', 'th.circle': '社团', 'th.price': '金额', 'th.memo': '备注',
    'csv.day': '日期', 'csv.name': '社团名', 'csv.account': '账号', 'csv.works': '作品·角色', 'csv.bought': '已买',
    'guess.name': '推测', 'guess.name.t': '社团名是推测出来的',
    'guess.char': '角色推测', 'guess.char.t': '从正文推测出来的',
    'has.shinagaki': '有品书', 'dual': '社团兼 Coser', 'posts.merged': '合并显示 {n} 条推文',
    'src.name': '显示名', 'src.bio': '简介', 'src.account': '同账号其他推文',
    'note.1': '非官方的爱好者工具，与 Comic Market 准备会及各社团没有任何关系。摊位和頒布信息是从 X 的推文里机械提取的，不保证准确 — 请务必以',
    'note.2': '为准。图片和正文的权利属于各发布者。本页只引用 X 上的原推文，不保存任何内容；原推文被删除后就不再显示。勾选和备注只存在你自己的浏览器里(localStorage)，不会发送到任何地方。',
    'note.link': '官方 Web Catalog',
  },
  en: {
    'title':        '{event} Circle Directory',
    'eyebrow':      '2026.08.15 – 08.16 · Tokyo Big Sight',
    'stat.circles': 'circles', 'stat.cosplayers': 'cosplayers', 'stat.tweets': 'from posts',
    'gen':          'Generated {when}', 'gen.overrides': ' · {n} manual fixes applied',
    'tab.map': 'Map', 'tab.plan': 'Plan', 'tab.circles': 'Circles', 'tab.cosplayers': 'Cosplayers',
    'search':       'Search circle, artist, character, series, text',
    'filters':      'Filters',
    'mark.must': '★ Must', 'mark.like': '♡ Maybe', 'mark.skip': '⊖ Skip', 'mark.buy': '✓ Bought',
    'buy.all': 'Bought: all', 'buy.todo': 'Not yet', 'buy.done': 'Bought only',
    'sort.space': 'By space', 'sort.new': 'Newest',
    'group':        'Group by circle',
    'media':        'With image',
    'count':        '{n} / {all} {unit}', 'unit.group': 'groups', 'unit.item': 'items',
    'view.cards': 'Cards', 'view.table': 'Table',
    'print':        'Print',     'print.t':  'Prints the current filter and order',
    'csv.t':        'Exports the current filter and order',
    'export':       'Export marks', 'export.t': 'Save marks and notes to a file for another device',
    'import':       'Import marks', 'import.ok': 'Imported ✓', 'import.ng': 'Could not import: {err}',
    'readall':      'Mark all read', 'readall.t': 'Clears every "new" flag',
    'bldg.all':     'All',
    'map.note':     'Drawn to the hall layout of the official floor plan. Aisles and exact island positions are not reproduced — check',
    'map.note.link': 'the Comiket Web Catalog',
    'map.note.end': ' for the authoritative placement',
    'zoom.out': 'Zoom out', 'zoom.in': 'Zoom in', 'zoom.fit': 'Fit',
    'map.stray':    'Blocks not in the floor plan',
    'plan.empty':   'Nothing marked yet.',
    'plan.empty2':  'Open a card from the circle list or the map and mark it <b>★ Must</b> or <b>♡ Maybe</b> — it will show up here.',
    'plan.note':    '{n} circles · the map shows only these',
    'plan.done':    'done',
    'day.n':        'Day {n}', 'day.unknown': 'Day unknown',
    'area.suffix':  ' area', 'space.unknown': 'Space unknown',
    'new':          'new',
    'more':         'Show all', 'less': 'Collapse',
    'source':       'Source',
    'memo':         'Notes', 'memo.ph': 'New book / want the freebie / if there is time…',
    'posts':        'Posts ({n})',
    'close':        'Close',
    'empty':        'Nothing matches the current filters',
    'th.state': 'Mark', 'th.space': 'Space', 'th.circle': 'Circle', 'th.price': 'Price', 'th.memo': 'Notes',
    'csv.day': 'Day', 'csv.name': 'Circle', 'csv.account': 'Account', 'csv.works': 'Series / character', 'csv.bought': 'Bought',
    'guess.name': 'guess', 'guess.name.t': 'Circle name is inferred',
    'guess.char': 'character guess', 'guess.char.t': 'Inferred from the post text',
    'has.shinagaki': 'has lineup image', 'dual': 'circle & cosplayer', 'posts.merged': '{n} posts merged',
    'src.name': 'display name', 'src.bio': 'bio', 'src.account': 'another post',
    'note.1': 'An unofficial, fan-made tool. Not affiliated with the Comic Market Preparatory Committee or any circle. Placement and release details are extracted mechanically from posts on X and are not guaranteed to be correct — always confirm against',
    'note.2': '. Images and text belong to their posters. This page only references the original posts on X and stores nothing; if a post is deleted it stops showing. Marks and notes live only in your own browser (localStorage) and are never sent anywhere.',
    'note.link': 'the official Web Catalog',
  },
};

/** 端末の言語から選ぶ。日本語以外の中国語圏は zh、それ以外は en に寄せる */
function detectLang() {
  const saved = (() => { try { return localStorage.getItem('c108.lang'); } catch { return null; } })();
  if (saved && I18N[saved]) return saved;
  for (const l of navigator.languages || [navigator.language || '']) {
    const s = String(l).toLowerCase();
    if (s.startsWith('ja')) return 'ja';
    if (s.startsWith('zh')) return 'zh';
    if (s.startsWith('en')) return 'en';
  }
  return 'ja';
}

let lang = detectLang();

/** 訳語を引く。{n} のような差し込みは第 2 引数で渡す */
function t(key, vars) {
  let s = (I18N[lang] || I18N.ja)[key];
  if (s === undefined) s = I18N.ja[key] !== undefined ? I18N.ja[key] : key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : vars[k])) : s;
}

/*
 * 日付の見出し。データに入っている label は日本語なので、そのままだと言語を変えても
 * ここだけ日本語で残る。日付から組み直す。
 */
const DAY_LABEL_FOR = (d) => {
  const day = DATA.event.days.find(x => x.day === d);
  if (!day) return t('day.n', { n: d });
  const dt = new Date(day.date + 'T00:00:00');
  const loc = lang === 'ja' ? 'ja-JP' : lang === 'zh' ? 'zh-CN' : 'en-US';
  const md = dt.toLocaleDateString(loc, { month: 'numeric', day: 'numeric', weekday: 'short' });
  return t('day.n', { n: d }) + ' ' + md;
};
let DAY_LABEL = {};

const SOURCE_LABEL_FOR = () => ({ name: t('src.name'), bio: t('src.bio'), account: t('src.account') });
let SOURCE_LABEL = {};

/**
 * 画面の言葉を今の言語に入れ替える。
 *
 * 固定の文言は HTML 側に data-i18n を付けてあり、ここで一括で流し込む。
 * 初期表示は日本語のまま書いてあるので、JS が動く前でも文字の無い画面にはならない。
 */
function applyLang(next) {
  if (next && I18N[next]) {
    lang = next;
    try { localStorage.setItem('c108.lang', lang); } catch {}
  }
  DAY_LABEL = Object.fromEntries(DATA.event.days.map(d => [d.day, DAY_LABEL_FOR(d.day)]));
  SOURCE_LABEL = SOURCE_LABEL_FOR();
  document.documentElement.lang = lang;

  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  // 日程チップのラベルは訳語ではなく日付から組む
  for (const el of document.querySelectorAll('#day-filter [data-day]')) el.textContent = DAY_LABEL[el.dataset.day];
  for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));

  document.title = t('title', { event: DATA.event.name });
  const h1 = document.querySelector('.head h1');
  if (h1) h1.textContent = document.title;
  const gen = document.querySelector('.gen');
  if (gen) {
    const when = new Date(DATA.generatedAt).toLocaleString(lang === 'ja' ? 'ja-JP' : lang === 'zh' ? 'zh-CN' : 'en-US');
    gen.textContent = t('gen', { when }) +
      (DATA.stats.overridesApplied ? t('gen.overrides', { n: DATA.stats.overridesApplied }) : '');
  }
  // 状態によって文言が変わるボタンは、押されたときと同じ規則で入れ直す
  const sortBtn = document.getElementById('sort-toggle');
  if (sortBtn) sortBtn.textContent = state.sort === 'space' ? t('sort.space') : t('sort.new');
  const buyBtn = document.getElementById('buy-filter');
  if (buyBtn) buyBtn.textContent = t('buy.' + state.buyFilter);
  const sel = document.getElementById('lang');
  if (sel) sel.value = lang;

  render();
}

// 公式配置図から起こしたホール構成と、ブロック→ホールの逆引き
const FLOOR = __FLOOR__;
// 企業ブースの番号 → 出展社名。企業ブースパンフレットから
const COMPANY_OF = __COMPANY_OF__;
const HALL_OF = __HALL_OF__;
const BLOCK_OF = __BLOCK_OF__;

/** ツイートの配置を公式表記に揃える。揃わないものは null(構成表に無いブロック) */
function official(b) {
  if (!b || !b.area) return null;
  // 企業ブースはブロック記号が無く、番号そのものが場所。解析時にホールまで引いてある
  if (b.kind === 'company') {
    return b.hall ? { area: b.area, hall: b.hall, block: null, company: b.number } : null;
  }
  if (!b.block) return null;
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
/** ★絶対 と ♡気になる。当日まわるのはこの 2 つ */
const PLANNED = new Set(['must', 'like']);
const isPlanned = sn => PLANNED.has(markOf(sn).s);
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
      (e.circleNameConfidence === 'low'
        ? '<span class="flag" title="' + esc(t('guess.name.t')) + '">' + esc(t('guess.name')) + '</span>' : '') : '') +
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
  if (d.length) bits.push(esc(d.map(x => DAY_LABEL[x] || t('day.n', { n: x })).join(' / ')));
  if (e.locations && e.locations.length) bits.push(esc(e.locations.join(' · ')));
  if (e.price) bits.push(esc(e.price));
  if (e.hasShinagaki) bits.push(esc(t('has.shinagaki')));
  if (e.dual) bits.push(esc(t('dual')));
  if (e.posts > 1) bits.push(esc(t('posts.merged', { n: e.posts })));

  let html = '<div class="foot">' + (bits.length ? '<span>' + bits.join(' · ') + '</span>' : '');
  if (e.charactersConfidence === 'low' && (e.characters || []).length)
    html += '<span class="flag" title="' + esc(t('guess.char.t')) + '">' + esc(t('guess.char')) + '</span>';
  return html + '<a class="src" href="' + esc(e.url) + '" target="_blank" rel="noopener">' + esc(t('source')) + ' ↗</a></div>';
}

const MARK_KEYS = ['must', 'like', 'skip', 'buy'];

function marksHtml(sn) {
  const m = markOf(sn);
  return '<div class="marks" data-sn="' + esc(sn) + '">' + MARK_KEYS.map(k => [k, t('mark.' + k)]).map(([k, label]) =>
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
    whoHtml(e) + (isNew(e) ? '<div><span class="flag new">' + esc(t('new')) + '</span></div>' : '') + tagsHtml(e) +
    shotsHtml(e) +
    (e.text ? '<div class="body">' + esc(e.text) + '</div><button class="more" type="button">' + esc(t('more')) + '</button>' : '') +
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
    '<td><a href="' + esc(e.url) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">' + esc(t('source')) + '</a></td>' +
  '</tr>';
}

/** 現在の一覧。グループ化の有無で件数そのものが変わる */
function rowsFor(kind) {
  // プランは「印を付けたサークルだけ」。並びも当日まわる順(配置順)で固定する
  if (kind === 'plan') return groupByAccount(DATA.circles).filter(e => isPlanned(e.screenName));
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
      const key = o.company
        ? 'C/' + o.area + '/' + o.hall + '/' + o.company
        : o.area + '/' + o.hall + '/' + o.block + '/' + (b.number ?? 0);
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

/**
 * 企業ブースのホール。ブロック記号が無いので、番号のまとまりごとに並べるだけ。
 * 空いているマスを作らない —— 番号は飛び飛び(1111 の次が 1121)なので、
 * 連番として敷き詰めると実在しない場所を大量に描くことになる。
 */
function companyHallHtml(area, hall, spaces) {
  const groups = hall.groups.map(g => {
    const cells = g.booths.map(b => {
      // 出展社名はパンフレットから分かっている。ツイートが無くても必ず出す ——
      // 「どこが何のブースか」が分からなければ地図の意味がない
      const at = spaces.get('C/' + area + '/' + hall.hall + '/' + b.no);
      const label = '<span class="num">' + b.no + '</span><span class="nm">' + esc(b.name) + '</span>';
      const where = area + hall.hall + ' ' + b.no + '  ' + b.name;
      if (!at || !at.length) return '<span class="cb vacant" title="' + esc(where) + '">' + label + '</span>';
      // ツイートが採れているブースは押すと詳細が開く
      const posts = at.map(e => e.circleName || e.displayName);
      const mark = markOf(at[0].screenName).s;
      return '<button class="cb" type="button" data-area="' + esc(area) + '"' +
        (mark ? ' data-mark="' + mark + '"' : '') +
        ' data-sn="' + esc(at[0].screenName) + '"' +
        ' title="' + esc(where + '  —  ' + posts.join(' / ')) + '">' + label + '</button>';
    }).join('');
    return '<div class="cgroup">' + (g.label ? '<span class="glabel">' + esc(g.label) + '</span>' : '') +
      '<div class="cbooths">' + cells + '</div></div>';
  }).join('');

  return '<div class="mhall" data-area="' + esc(area) + '"><span class="name">' + esc(area + hall.hall) +
         'ホール</span><div class="cgroups">' + groups + '</div></div>';
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
  if (state.tab !== 'map' && state.tab !== 'plan') { wrap.hidden = true; return; }
  wrap.hidden = false;

  const { spaces, strays } = buildSpaceIndex(rows);
  let html = '';

  // 会場を真上から見た並びのまま組む。棟が横に並ぶ段はそのまま横に並べる
  for (const row of FLOOR) {
    const shown = row.buildings.filter(b => !state.bldg || state.bldg === b.id);
    if (!shown.length) continue;
    html += '<div class="frow">' + shown.map(b =>
      '<div class="bldg" data-area="' + esc(b.area) + '" data-id="' + esc(b.id) + '">' +
      '<div class="bhalls">' + (b.companies
        ? b.companies.map(h => companyHallHtml(b.area, h, spaces)).join('')
        : b.halls.map(h => hallHtml(b.area, h, spaces)).join('')) + '</div></div>'
    ).join('') + '</div>';
  }

  if (strays.size && !state.bldg) {
    const list = [...strays.entries()].map(([k, n]) => esc(k.replace('/', ' ')) + ' (' + n + ')').join('  ');
    html += '<div class="frow"><div class="bldg stray"><h4>' + esc(t('map.stray')) + '</h4>' +
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

/*
 * 会場の周りに空ける余白。地図の端で動きが止まらないようにするためのもの。
 *
 * 余白なしだと、スクロールできる範囲が会場の実寸ちょうどになり、端の島は必ず
 * 画面の端に貼りついたままになる。拡大したとき、上端の島は浮かせた検索欄の
 * 下に入ったきり引っ張り出せない —— どれだけ動かしても、もう上には何も無いので
 * スクロールが効かない。
 *
 * 画面の半分ぶん空けておけば、会場のどの点でも画面の中央まで持ってこられる。
 * それ以上は要らない(会場を完全に画面外へ追い出せてしまう)。
 */
let gutter = { x: 0, y: 0 };

function applyZoom(z) {
  // 下限は低めに。会場は横に長いので、狭い画面だと全体表示で 10% 台になる。
  // 縮小時は文字を出さないので、小さくても輪郭の見取り図としては成立する
  zoom = Math.min(4, Math.max(0.07, z));
  const canvas = document.getElementById('mapcanvas');
  const scroll = document.getElementById('mapscroll');
  canvas.style.transform = 'scale(' + zoom + ')';

  /*
   * 余白は「はみ出している向き」にだけ付ける。全体表示のように会場が画面に
   * 収まりきっている間は 0 —— そこで余白を付けると、動かす必要が無いのに
   * スクロールできてしまい、会場を画面の隅へ押しやれてしまう。
   */
  const over = (side, len) => (len * zoom > side ? Math.round(side / 2) : 0);
  gutter = { x: over(scroll.clientWidth, natural.w), y: over(scroll.clientHeight, natural.h) };
  canvas.style.left = gutter.x + 'px';
  canvas.style.top = gutter.y + 'px';

  // スクロール範囲を見た目の大きさ + 前後の余白に合わせる
  const sizer = document.getElementById('mapsizer');
  sizer.style.width = Math.round(natural.w * zoom) + gutter.x * 2 + 'px';
  sizer.style.height = Math.round(natural.h * zoom) + gutter.y * 2 + 'px';

  // 縮小時は文字を出さない。読めない字を並べても意味がないし、描画も重い
  canvas.dataset.detail = zoom < 0.7 ? '0' : zoom < 1.25 ? '1' : '2';
  document.getElementById('zoomlabel').textContent = Math.round(zoom * 100) + '%';
}

/** 会場を画面の真ん中に置く。余白があるぶん、左上に寄せるのでは端に寄って見える */
function centerMap() {
  const s = document.getElementById('mapscroll');
  s.scrollLeft = Math.round((s.scrollWidth - s.clientWidth) / 2);
  s.scrollTop = Math.round((s.scrollHeight - s.clientHeight) / 2);
}

/**
 * ある一点を動かさずに倍率だけ変える。
 * 指定が無ければ画面の中央を軸にする —— ボタンで拡大したとき、
 * 見ていた場所がそのまま大きくなるのが素直な動き。
 */
function zoomAt(z, px, py) {
  const s = document.getElementById('mapscroll');
  const box = s.getBoundingClientRect();
  const ax = px === undefined ? box.width / 2 : px;
  const ay = py === undefined ? box.height / 2 : py;
  // その点が会場のどこかを、今の倍率で覚えてから拡大する
  const wx = (s.scrollLeft + ax - gutter.x) / zoom;
  const wy = (s.scrollTop + ay - gutter.y) / zoom;
  applyZoom(z);
  s.scrollLeft = wx * zoom + gutter.x - ax;
  s.scrollTop = wy * zoom + gutter.y - ay;
}

/**
 * 地図を画面の残りにちょうど収める。
 * 見出しと絞り込みの下に固定の高さで置くと、地図の中とページの両方がスクロールして
 * どちらを動かしているのか分からなくなる。残りいっぱいまで伸ばして外側は動かさない。
 */
const isPhoneApp = () => document.body.classList.contains('app') && matchMedia('(max-width: 720px)').matches;

function sizeMapScroll() {
  const scroll = document.getElementById('mapscroll');
  /*
   * スマホでは画面に貼り付けたアプリとして組んであり、余りの高さは flex が決める。
   * ここで height を入れると下のタブバーぶんを二重に数えて、地図が上の棟チップに
   * かぶってしまう。CSS に任せる。
   */
  if (isPhoneApp()) {
    scroll.style.flex = '';
    scroll.style.height = '';
    return;
  }
  const top = scroll.getBoundingClientRect().top + window.scrollY;
  const rest = Math.max(300, window.innerHeight - top - 16);
  // flex: 1 のままだと height を無視されるので、こちらで決めると宣言してから入れる
  scroll.style.flex = 'none';
  /*
   * プランでは主役は一覧のほう。地図に画面いっぱい使わせると一覧が折り返しの下に隠れ、
   * 「印を付けた店を順に見る」という本来の使い方ができない。地図は俯瞰として低く置く。
   */
  scroll.style.height = (state.tab === 'plan' ? Math.min(rest, Math.round(window.innerHeight * 0.34)) : rest) + 'px';
}

/** 会場が丸ごと収まる倍率にして真ん中に置く。縦も入れないと南まで見えない */
function fitZoom() {
  sizeMapScroll();
  const scroll = document.getElementById('mapscroll');
  const pad = 4;
  /*
   * 倍率によって細かさ(= 企業ブースのマスの大きさや文字の有無)が変わり、
   * 細かさが変わると実寸も変わる。1 回測って合わせただけでは、合わせた結果の
   * レイアウトに対しては合っていない。2 回まわして落ち着かせる。
   */
  for (let pass = 0; pass < 2; pass++) {
    measureCanvas();
    const byW = natural.w ? (scroll.clientWidth - pad) / natural.w : 1;
    const byH = natural.h ? (scroll.clientHeight - pad) / natural.h : 1;
    // 「全体」は縮めるためのもの。小さい棟だけを出したときに引き伸ばすと、
    // マスばかり大きくなって一度に見える範囲がかえって狭くなる
    applyZoom(Math.min(1, byW, byH));
  }
  centerMap();
}

/**
 * プラン: 印を付けたサークルを当日まわる順に並べる。
 *
 * 日 → 地区 → 配置順。会場では日をまたがず、地区もまたがず、
 * ブロック順に歩くので、その順に並んでいないと現地で使えない。
 */
function renderPlan(rows) {
  const wrap = document.getElementById('planwrap');
  if (state.tab !== 'plan') { wrap.hidden = true; return; }
  wrap.hidden = false;

  if (!rows.length) {
    wrap.innerHTML = '<div class="empty">' + esc(t('plan.empty')) + '<br>' + t('plan.empty2') + '</div>';
    return;
  }

  // 日 → 地区 → 配置。日の分からないものは最後にまとめる
  const buckets = new Map();
  for (const e of rows) {
    const b = (e.booths || []).find(x => official(x)) || (e.booths || [])[0];
    const o = b ? official(b) : null;
    const day = (e.days && e.days.length === 1) ? e.days[0] : (b && b.day) || 0;
    const area = o ? o.area : '—';
    const key = day + '/' + area;
    if (!buckets.has(key)) buckets.set(key, { day, area, items: [] });
    buckets.get(key).items.push({ e, b, o });
  }

  const order = { '東': 0, '西': 1, '南': 2, '—': 3 };
  const groups = [...buckets.values()].sort((a, b) =>
    (a.day || 9) - (b.day || 9) || order[a.area] - order[b.area]);

  const counts = { must: 0, like: 0 };
  for (const e of rows) counts[markOf(e.screenName).s] = (counts[markOf(e.screenName).s] || 0) + 1;

  let html = '<div class="plansum">' +
    '<span class="pill must">★ ' + counts.must + '</span>' +
    '<span class="pill like">♡ ' + counts.like + '</span>' +
    '<span class="pnote">' + esc(t('plan.note', { n: rows.length })) + '</span></div>';

  for (const g of groups) {
    g.items.sort((x, y) => bySpace(x.e, y.e));
    html += '<section class="pgroup"><h3>' +
      esc(g.day ? (DAY_LABEL[g.day] || t('day.n', { n: g.day })) : t('day.unknown')) +
      '<span class="parea" data-area="' + esc(g.area) + '">' +
        esc(g.area === '—' ? t('space.unknown') : g.area + t('area.suffix')) + '</span>' +
      '<span class="pn">' + g.items.length + '</span></h3><ul class="plist">';
    for (const { e, b, o } of g.items) {
      const m = markOf(e.screenName);
      html += '<li><button class="prow" type="button" data-sn="' + esc(e.screenName) + '">' +
        '<span class="pmark ' + esc(m.s) + '">' + (m.s === 'must' ? '★' : '♡') + '</span>' +
        '<span class="pspace"' + (o ? ' data-area="' + esc(o.area) + '"' : '') + '>' +
          esc(b ? b.display.replace(/^\d日目\s*/, '') : t('space.unknown')) + '</span>' +
        '<span class="pname">' + esc(e.circleName || e.displayName) +
          (m.m ? '<span class="pmemo">' + esc(m.m) + '</span>' : '') + '</span>' +
        (m.b ? '<span class="pdone">' + esc(t('plan.done')) + '</span>' : '') +
        '</button></li>';
    }
    html += '</ul></section>';
  }
  wrap.innerHTML = html;
}

function render() {
  const onMap = state.tab === 'map';
  const onPlan = state.tab === 'plan';
  // 地図タブはサークルを描く。プランタブは印を付けたものだけ
  const kind = onMap ? 'circles' : state.tab;
  const all = rowsFor(kind);
  const base = all.filter(matches);
  const list = base.sort(state.sort === 'space' ? bySpace : byNewest);
  lastList = list;

  // 地図とプランは画面に貼り付けたアプリとして見せる。一覧は普通に縦スクロールさせる
  document.body.classList.toggle('app', onMap || onPlan);
  // プランは地図を低く、一覧を主役にする。高さの配分は CSS 側で決める
  document.body.classList.toggle('tab-plan', onPlan);
  // 地図タブだけ、検索欄と棟のチップを地図の上に浮かせる
  document.body.classList.toggle('tab-map', onMap);

  renderMap(base);
  renderPlan(onPlan ? list : []);
  document.getElementById('plan-n').textContent = rowsFor('plan').length;
  document.getElementById('count').textContent =
    t('count', { n: list.length, all: all.length, unit: t(state.grouped ? 'unit.group' : 'unit.item') });

  for (const t of ['circles', 'cosplayers']) {
    const n = rowsFor(t).length;
    const badge = document.querySelector('.tab[data-tab="' + t + '"] .n');
    if (badge) badge.textContent = n;
    const stat = document.getElementById('stat-' + t);
    if (stat) stat.textContent = n;
  }
  // 地区で絞れるのはサークルだけ。地図タブでは常に出す
  document.getElementById('area-filter').hidden = !onMap && !onPlan && state.tab !== 'circles';
  document.querySelector('.viewpick').hidden = onMap || onPlan;
  // CSV・印刷・持ち出しは一覧のための道具。地図では場所を取るだけなので隠す
  document.querySelector('.toolbar2').hidden = onMap;

  const grid = document.getElementById('grid');
  const twrap = document.getElementById('ltable-wrap');

  if (onMap || onPlan) {
    grid.hidden = true;
    twrap.hidden = true;
    document.getElementById('empty').hidden = true;
    return;
  }

  if (state.view === 'table') {
    grid.hidden = true;
    twrap.hidden = false;
    twrap.innerHTML = '<table class="ltable"><thead><tr>' +
      ['th.state', 'th.space', 'th.circle', 'th.price', 'th.memo'].map(k => '<th>' + esc(t(k)) + '</th>').join('') + '<th></th>' +
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
  const rows = [[t('th.state'), t('csv.bought'), t('csv.day'), t('th.space'), t('csv.name'),
                 t('csv.account'), t('th.price'), t('csv.works'), t('th.memo'), 'URL']];
  for (const e of lastList) {
    const m = markOf(e.screenName);
    rows.push([
      m.s ? t('mark.' + m.s) : '',
      m.b ? t('plan.done') : '',
      entryDays(e).map(d => t('day.n', { n: d })).join('/'),
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
    '<table><thead><tr><th>✓</th>' +
    ['th.state', 'th.space', 'th.circle', 'th.price', 'th.memo'].map(k => '<th>' + esc(t(k)) + '</th>').join('') +
    '</tr></thead><tbody>' +
    lastList.map(e => {
      const m = markOf(e.screenName);
      return '<tr><td>' + (m.b ? '✓' : '　') + '</td><td>' + (m.s ? q(t('mark.' + m.s)) : '') +
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
  const kind = ['circles', 'cosplayers'].find(k => DATA[k].some(e => e.screenName === sn));
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
    '<div class="sec">' + esc(t('memo')) + '</div>' +
    '<textarea class="memo" id="panel-memo" placeholder="' + esc(t('memo.ph')) + '">' + esc(m.m || '') + '</textarea>' +
    '<div class="sec">' + esc(t('posts', { n: posts.length })) + '</div>' +
    posts.map(e =>
      '<div class="post"><time>' + esc((e.createdAt || '').slice(0, 16).replace('T', ' ')) + '</time>' +
      shotsHtml(e) +
      (e.text ? '<div class="body">' + esc(e.text) + '</div>' : '') +
      '<div class="foot"><a class="src" href="' + esc(e.url) + '" target="_blank" rel="noopener">' + esc(t('source')) + ' ↗</a></div></div>'
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
  if (state.tab === 'map' || state.tab === 'plan') fitZoom();
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
  ev.currentTarget.textContent = state.sort === 'space' ? t('sort.space') : t('sort.new');
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
  ev.currentTarget.textContent = t('buy.' + state.buyFilter);
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
    document.getElementById('import-btn').textContent = t('import.ok');
    setTimeout(() => { document.getElementById('import-btn').textContent = t('import'); }, 2000);
  } catch (err) {
    alert(t('import.ng', { err: err.message }));
  }
  ev.target.value = '';
});
document.getElementById('import-btn').addEventListener('click', () =>
  document.getElementById('import-file').click());

document.getElementById('read-all-btn').addEventListener('click', () => {
  for (const tab of ['circles', 'cosplayers']) {
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

document.getElementById('zoom-in').addEventListener('click', () => zoomAt(zoom * 1.4));
document.getElementById('zoom-out').addEventListener('click', () => zoomAt(zoom / 1.4));
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
    // つまんだ点が会場のどこかを、今の倍率で覚えておく(余白ぶんを引いた座標)
    cx: (mapScroll.scrollLeft + mid.x - box.left - gutter.x) / zoom,
    cy: (mapScroll.scrollTop + mid.y - box.top - gutter.y) / zoom,
  };
}, { passive: true });

mapScroll.addEventListener('touchmove', ev => {
  if (!pinch || ev.touches.length !== 2) return;
  ev.preventDefault();
  const t = [ev.touches[0], ev.touches[1]];
  applyZoom(pinch.zoom * (touchDist(t) / pinch.dist));

  const mid = touchMid(t);
  const box = mapScroll.getBoundingClientRect();
  mapScroll.scrollLeft = pinch.cx * zoom + gutter.x - (mid.x - box.left);
  mapScroll.scrollTop = pinch.cy * zoom + gutter.y - (mid.y - box.top);
}, { passive: false });

mapScroll.addEventListener('touchend', ev => { if (ev.touches.length < 2) pinch = null; }, { passive: true });

/*
 * 地図を動かしている間だけ、上に浮かせた検索欄と棟のチップを引っ込める。
 * 引っかけるのは touchmove —— touchstart にすると、マスを軽く叩いただけでも
 * 一瞬ちらつく。動かし始めて初めて「今は地図を見ている」と分かる。
 */
(() => {
  const chrome = [document.querySelector('.toolbar'), document.getElementById('bldgbar')].filter(Boolean);
  const away = (on) => { for (const el of chrome) el.classList.toggle('away', on); };
  mapScroll.addEventListener('touchmove', () => away(true), { passive: true });
  for (const ev of ['touchend', 'touchcancel']) {
    mapScroll.addEventListener(ev, e => { if (!e.touches.length) away(false); }, { passive: true });
  }
  // 棟を選び直したときは必ず出ている状態から始める
  document.getElementById('bldgbar').addEventListener('click', () => away(false));
})();

/**
 * 素早く 2 回叩いたら拡大、拡大済みなら全体へ戻す。
 * 叩いた場所を中心に寄せる —— そうしないと拡大した先が画面外で、
 * 見たかった場所を探し直すことになる。
 */
let lastTap = 0;
let lastTapAt = { x: 0, y: 0 };
mapScroll.addEventListener('touchend', ev => {
  if (ev.touches.length || pinch) return;
  const t = ev.changedTouches[0];
  const now = Date.now();
  const near = t && Math.hypot(t.clientX - lastTapAt.x, t.clientY - lastTapAt.y) < 40;
  if (now - lastTap < 300 && near) {
    if (ev.target.closest('.sp') || ev.target.closest('.cb')) return; // マスを開く操作を邪魔しない
    if (zoom > 1) { fitZoom(); return; }
    const box = mapScroll.getBoundingClientRect();
    // 叩いた場所を軸にして拡大する。軸を画面中央に取ると見たかった所が画面外へ飛ぶ
    zoomAt(1.8, t.clientX - box.left, t.clientY - box.top);
  }
  lastTap = now;
  if (t) lastTapAt = { x: t.clientX, y: t.clientY };
}, { passive: true });

/**
 * 詳細シートはつまんで下へ払うと閉じる。
 * 画面の下から出るものは下へ払って閉じるのが当たり前になっているので、
 * ✕ を探さずに済む。中身を縦に読んでいる途中は掴まない(一番上にいるときだけ)。
 */
(() => {
  const panel = document.getElementById('panel');
  let start = null;
  panel.addEventListener('touchstart', ev => {
    if (ev.touches.length !== 1) { start = null; return; }
    // 取っ手からなら常に、本文からは一番上まで戻っているときだけ掴む
    const onGrab = ev.target.closest('.grab') || panel.scrollTop <= 0;
    start = onGrab ? { y: ev.touches[0].clientY, t: Date.now() } : null;
  }, { passive: true });

  panel.addEventListener('touchmove', ev => {
    if (!start || ev.touches.length !== 1) return;
    const dy = ev.touches[0].clientY - start.y;
    if (dy <= 0) { panel.style.transform = ''; return; }
    panel.style.transform = 'translateY(' + dy + 'px)';
  }, { passive: true });

  panel.addEventListener('touchend', ev => {
    if (!start) return;
    const dy = (ev.changedTouches[0] || {}).clientY - start.y;
    const quick = Date.now() - start.t < 300;
    panel.style.transform = '';
    // 大きく下げたか、素早く払ったら閉じる
    if (dy > panel.offsetHeight * 0.3 || (quick && dy > 70)) closePanel();
    start = null;
  }, { passive: true });
})();

// プランの行を押したらそのサークルの詳細を開く
document.getElementById('planwrap').addEventListener('click', ev => {
  const row = ev.target.closest('.prow');
  if (row) openPanel(row.dataset.sn);
});

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
    ev.target.textContent = t(body.classList.contains('open') ? 'less' : 'more');
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

initSeen([...DATA.circles, ...DATA.cosplayers]);
// applyLang が中で render() まで面倒を見る
applyLang();
fitZoom();

// 言語を切り替える。地図の倍率は保ったまま、文言だけ入れ替える
document.getElementById('lang').addEventListener('change', ev => {
  applyLang(ev.target.value);
  fitZoom();
});
// フォントが差し替わると地図の実寸が数 px 変わる。落ち着いてからもう一度測って合わせ直す
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { if (state.tab === 'map' || state.tab === 'plan') fitZoom(); });
}
addEventListener('resize', () => { if (state.tab === 'map' || state.tab === 'plan') fitZoom(); });
`;

export function renderHtml(dataset: Dataset): string {
    const { stats, event, generatedAt } = dataset;
    const dayChips = event.days
        // ラベルは applyLang が日付から組み直す。ここは JS が動く前の見え方だけ
        .map((d) => `<button class="chip" type="button" data-value="${d.day}" data-day="${d.day}" aria-pressed="false">${d.label}</button>`)
        .join('');
    // 地図の絞り込みは棟単位。会場でも「東は東、西は西」でしか動かない
    const bldgChips = buildingIds()
        .map((id) => `<button class="chip" type="button" data-bldg="${id}" aria-pressed="false">${id}</button>`)
        .join('');

    // 共有されたときに出る一文。中身が分かる数字を入れておく
    const desc = `X の投稿から集めた ${stats.circles} サークル・${stats.cosplayers} コスプレイヤーの配置を、` +
        `会場の見取り図から探せる非公式のまとめ。`;

    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<!--
  viewport-fit=cover は、下端のタブバーを画面の端まで届かせるため。
  はみ出したぶんは env(safe-area-inset-bottom) で内側に戻している。
-->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${event.name} 情報まとめ</title>
<meta name="description" content="${attr(desc)}">
<!-- X や LINE に貼られたときに何のページか分かるように。画像は持たないので文字だけ -->
<meta property="og:type" content="website">
<meta property="og:title" content="${attr(event.name)} 情報まとめ (非公式)">
<meta property="og:description" content="${attr(desc)}">
<meta name="twitter:card" content="summary">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="head">
    <div class="eyebrow" data-i18n="eyebrow">2026.08.15 – 08.16 · 東京ビッグサイト</div>
    <h1>${event.name} 情報まとめ</h1>
    <div class="summary">
      <div class="stat"><b id="stat-circles">${stats.circles}</b><span data-i18n="stat.circles">サークル</span></div>
      <div class="stat"><b id="stat-cosplayers">${stats.cosplayers}</b><span data-i18n="stat.cosplayers">コスプレイヤー</span></div>
      <div class="stat"><b>${stats.tweets}</b><span data-i18n="stat.tweets">ツイートから</span></div>
    </div>
    <div class="gen">生成 ${new Date(generatedAt).toLocaleString('ja-JP')}${stats.overridesApplied ? ` · 人工修正 ${stats.overridesApplied} 件適用` : ''}</div>
  </header>

  <nav class="tabs" role="tablist">
    <button class="tab" type="button" role="tab" data-tab="map" aria-selected="true"><span data-i18n="tab.map">地図</span></button>
    <button class="tab" type="button" role="tab" data-tab="plan" aria-selected="false"><span data-i18n="tab.plan">プラン</span><span class="n" id="plan-n">0</span></button>
    <button class="tab" type="button" role="tab" data-tab="circles" aria-selected="false"><span data-i18n="tab.circles">サークル</span><span class="n">${stats.circles}</span></button>
    <button class="tab" type="button" role="tab" data-tab="cosplayers" aria-selected="false"><span data-i18n="tab.cosplayers">コスプレイヤー</span><span class="n">${stats.cosplayers}</span></button>
  </nav>

  <div class="toolbar">
    <input id="q" type="search" data-i18n-ph="search" placeholder="サークル名 / 作者 / キャラ / 作品 / 本文 を検索">
    <!-- 言語切り替え。どのタブでもツールバーは出ているので、ここに置けば常に手が届く -->
    <select id="lang" class="langpick" aria-label="Language">
      <option value="ja">日本語</option>
      <option value="zh">中文</option>
      <option value="en">English</option>
    </select>
    <button class="chip" type="button" id="filter-toggle" aria-expanded="false" data-i18n="filters">絞り込み</button>
    <div class="chips" id="day-filter">${dayChips}</div>
    <div class="chips" id="area-filter">
      <button class="chip" type="button" data-value="東" aria-pressed="false">東</button>
      <button class="chip" type="button" data-value="西" aria-pressed="false">西</button>
      <button class="chip" type="button" data-value="南" aria-pressed="false">南</button>
    </div>
    <div class="chips" id="mark-filter">
      <button class="chip" type="button" data-value="must" aria-pressed="false" data-i18n="mark.must">★絶対</button>
      <button class="chip" type="button" data-value="like" aria-pressed="false" data-i18n="mark.like">♡気になる</button>
    </div>
    <div class="chips">
      <button class="chip" type="button" id="buy-filter" aria-pressed="false">購入: すべて</button>
      <button class="chip" type="button" id="sort-toggle" data-sort="space">配置順</button>
      <button class="chip" type="button" id="group-toggle" aria-pressed="true" data-i18n="group">サークル単位</button>
      <button class="chip" type="button" id="media-only" aria-pressed="false" data-i18n="media">画像あり</button>
    </div>
    <span class="count" id="count"></span>
  </div>

  <div class="toolbar2">
    <div class="chips viewpick">
      <button class="chip" type="button" data-view="cards" aria-pressed="true" data-i18n="view.cards">カード</button>
      <button class="chip" type="button" data-view="table" aria-pressed="false" data-i18n="view.table">表</button>
    </div>
    <span class="spacer"></span>
    <button class="chip" type="button" id="csv-btn" data-i18n-title="csv.t" title="今の絞り込み・並び順で書き出します">CSV</button>
    <button class="chip" type="button" id="print-btn" data-i18n="print" data-i18n-title="print.t" title="今の絞り込み・並び順で印刷します">印刷</button>
    <button class="chip" type="button" id="export-btn" data-i18n="export" data-i18n-title="export.t" title="チェック・メモをファイルに書き出して別の端末へ">チェックを書き出す</button>
    <button class="chip" type="button" id="import-btn" data-i18n="import">チェックを読み込む</button>
    <input type="file" id="import-file" accept="application/json" hidden>
    <button class="chip" type="button" id="read-all-btn" data-i18n="readall" data-i18n-title="readall.t" title="「新着」の印をすべて消します">すべて既読にする</button>
  </div>

  <div class="mapwrap" id="mapwrap">
    <div class="bldgbar" id="bldgbar">
      <button class="chip" type="button" data-bldg="" aria-pressed="true" data-i18n="bldg.all">全体</button>
      ${bldgChips}
    </div>
    <div class="mapbar">
      <span class="note"><span data-i18n="map.note">公式配置図のホール構成に沿った地図です。通路や島の細かな位置までは再現していません —
        正確な配置は</span> <a href="https://webcatalog.circle.ms/" target="_blank" rel="noopener" data-i18n="map.note.link">コミケWebカタログ</a><span data-i18n="map.note.end"> で確認してください</span></span>
      <div class="zoom">
        <button class="zbtn" type="button" id="zoom-out" data-i18n-aria="zoom.out" aria-label="縮小">−</button>
        <button class="zbtn" type="button" id="zoom-in" data-i18n-aria="zoom.in" aria-label="拡大">＋</button>
        <button class="zbtn wide" type="button" id="zoom-fit" data-i18n="zoom.fit">全体</button>
        <span id="zoomlabel">100%</span>
      </div>
    </div>
    <div class="mapscroll" id="mapscroll"><div class="mapsizer" id="mapsizer"><div class="mapcanvas" id="mapcanvas" data-detail="1"></div></div></div>
  </div>

  <div class="planwrap" id="planwrap" hidden></div>

  <div class="grid" id="grid"></div>
  <div id="more-sentinel" hidden></div>
  <div class="ltable-wrap" id="ltable-wrap" hidden></div>
  <div class="empty" id="empty" data-i18n="empty" hidden>条件に合う項目がありません</div>

  <footer class="site-note">
    <span data-i18n="note.1">非公式のファンメイドツールです。コミックマーケット準備会および各サークルとは一切関係ありません。
    配置・頒布情報は X の投稿から機械的に抽出したもので、正確性は保証されません — 必ず</span>
    <a href="https://webcatalog.circle.ms/" target="_blank" rel="noopener" data-i18n="note.link">公式Webカタログ</a><span data-i18n="note.2"> 等でご確認ください。
    画像・本文の権利は各投稿者に帰属します。当ページは X 上の原ツイートを参照表示するだけで保存はしておらず、
    原ツイートが削除されると表示されなくなります。
    チェック・メモはお使いのブラウザ内(localStorage)にのみ保存され、どこにも送信されません。</span>
  </footer>
</div>

<aside id="panel" hidden>
  <span class="grab" aria-hidden="true"></span>
  <button class="close" type="button" data-i18n-aria="close" aria-label="閉じる">✕</button>
  <div id="panel-body"></div>
</aside>
<div id="backdrop" hidden></div>
<div id="printtable"></div>

<div id="lightbox"><img alt=""></div>

<script type="application/json" id="c108-data">${embedJson(dataset)}</script>
<script>${JS.replace('__FLOOR__', JSON.stringify(FLOOR)).replace('__COMPANY_OF__', JSON.stringify(companyNames())).replace('__HALL_OF__', JSON.stringify(buildHallLookup())).replace('__BLOCK_OF__', JSON.stringify(buildBlockLookup()))}</script>
</body>
</html>
`;
}
