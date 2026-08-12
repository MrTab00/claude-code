/**
 * 单文件 HTML 模板。数据以 JSON 内嵌, CSS/JS 全内联, 零外部依赖。
 * 双击即开, 也能直接发给别人。
 *
 * 配色は東/西/南の地区色でコード化している —— 会場で探すときに効くのは地区なので、
 * 装飾ではなく情報として色を使う。配置番号は等幅 + tabular-nums でカタログの表記に寄せる。
 */

import type { Dataset } from '../types';

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

/* --- 配置マップ --- */
.mapview {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 12px 14px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px;
}
.mapview > header { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.mapview h2 { font-size: 14px; margin: 0; font-weight: 600; }
.mapview .note { font-size: 11.5px; color: var(--muted); }
.mapview .note a { color: var(--accent); }
.mapview .clear {
  margin-left: auto; appearance: none; border: 1px solid var(--accent); background: var(--accent-soft);
  color: var(--accent); border-radius: 6px; padding: 4px 10px; font: 500 12px var(--sans); cursor: pointer;
}
.dayblock { display: flex; flex-direction: column; gap: 6px; }
.dayblock > h3 { font-size: 12px; margin: 0; color: var(--muted); font-weight: 600; }
.hallrow { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; }
.hallrow > .label {
  font: 600 11.5px var(--mono); color: var(--muted); min-width: 76px; padding-top: 5px;
  font-variant-numeric: tabular-nums;
}
.cells { display: flex; gap: 4px; flex-wrap: wrap; }
.cell {
  appearance: none; cursor: pointer; border-radius: 5px; padding: 3px 0 4px;
  width: 40px; text-align: center; border: 1px solid var(--border); background: var(--surface-2);
  display: flex; flex-direction: column; gap: 1px; line-height: 1.15;
}
.cell b { font: 600 13px var(--mono); color: var(--ink); }
.cell i { font: 500 10.5px var(--mono); font-style: normal; color: var(--muted); font-variant-numeric: tabular-nums; }
.cell[data-area="東"] { border-color: color-mix(in srgb, var(--east) 35%, var(--border)); }
.cell[data-area="西"] { border-color: color-mix(in srgb, var(--west) 35%, var(--border)); }
.cell[data-area="南"] { border-color: color-mix(in srgb, var(--south) 35%, var(--border)); }
.cell[data-level="2"][data-area="東"] { background: var(--east-soft); }
.cell[data-level="2"][data-area="西"] { background: var(--west-soft); }
.cell[data-level="2"][data-area="南"] { background: var(--south-soft); }
.cell[data-level="3"][data-area="東"] { background: var(--east-soft); box-shadow: inset 0 0 0 1px var(--east); }
.cell[data-level="3"][data-area="西"] { background: var(--west-soft); box-shadow: inset 0 0 0 1px var(--west); }
.cell[data-level="3"][data-area="南"] { background: var(--south-soft); box-shadow: inset 0 0 0 1px var(--south); }
.cell[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); }
.cell[aria-pressed="true"] b, .cell[aria-pressed="true"] i { color: var(--accent-ink); }

/* --- カード --- */
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

@media (max-width: 560px) {
  .wrap { padding: 16px 11px 56px; gap: 14px; }
  .grid { grid-template-columns: 1fr; }
  .count { margin-left: 0; width: 100%; }
  .toolbar { position: static; }
}
`;

const JS = String.raw`
const DATA = JSON.parse(document.getElementById('c108-data').textContent);
const DAY_LABEL = Object.fromEntries(DATA.event.days.map(d => [d.day, d.label]));

const SOURCE_LABEL = { name: '表示名', bio: 'プロフィール', account: '別ツイート' };

const state = { tab: 'circles', q: '', days: new Set(), areas: new Set(), mediaOnly: false,
  grouped: true, sort: 'space', cell: null, view: 'cards', markFilter: new Set(), buyFilter: 'all' };

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

/** ブロック格子で選んだマスに、この項目のどれかの配置が入っているか */
function inCell(e) {
  if (!state.cell) return true;
  const { day, area, hall, block } = state.cell;
  return (e.booths || []).some(b =>
    b.block === block && b.area === area && (b.hall ?? '') === hall && (b.day ?? 0) === day);
}

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

/** タブごとの現在の一覧。グループ化の有無で件数そのものが変わる */
function rowsFor(tab) {
  return state.grouped ? groupByAccount(DATA[tab]) : DATA[tab];
}

/** 英字 → 片仮名 → 平仮名 の順。地区ごとに使う文字種が違うので、混ざっても崩れないようにする */
function blockOrder(ch) {
  const c = ch.codePointAt(0);
  if (c < 0x3000) return c;            // A-Z
  if (c >= 0x30a1) return 10000 + c;   // カタカナ
  return 20000 + c;                    // ひらがな
}

/**
 * 収集できた配置からブロックの索引を組み立てる。
 *
 * 公式の会場平面図ではない —— ホール内の物理的な並びは手元のデータからは分からないので、
 * それらしい図を描くと現地で迷わせる。ここに出るのは「採れた配置がどのブロックに何件あるか」
 * だけで、全部が実データ由来。
 */
function buildBlockIndex(rows) {
  const days = new Map();
  for (const e of rows) {
    for (const b of e.booths || []) {
      if (!b.block || !b.area) continue;
      const day = b.day ?? 0;
      const hall = b.hall ?? '';
      if (!days.has(day)) days.set(day, new Map());
      const areas = days.get(day);
      if (!areas.has(b.area)) areas.set(b.area, new Map());
      const halls = areas.get(b.area);
      if (!halls.has(hall)) halls.set(hall, new Map());
      const blocks = halls.get(hall);
      blocks.set(b.block, (blocks.get(b.block) || 0) + 1);
    }
  }
  return days;
}

function renderMap(rows) {
  const view = document.getElementById('mapview');
  if (state.tab !== 'circles') { view.hidden = true; return; }

  const index = buildBlockIndex(rows);
  view.hidden = index.size === 0;
  if (!index.size) return;

  const max = Math.max(...[...index.values()].flatMap(a => [...a.values()].flatMap(h => [...h.values()].flatMap(b => [...b.values()]))));
  const dayKeys = [...index.keys()].sort();
  let html = '';

  for (const day of dayKeys) {
    html += '<div class="dayblock"><h3>' + esc(DAY_LABEL[day] || '日程不明') + '</h3>';
    for (const area of ['東', '西', '南']) {
      const halls = index.get(day).get(area);
      if (!halls) continue;
      const hallKeys = [...halls.keys()].sort((a, b) => (Number(a) || 99) - (Number(b) || 99));
      for (const hall of hallKeys) {
        const blocks = [...halls.get(hall).entries()].sort((a, b) => blockOrder(a[0]) - blockOrder(b[0]));
        html += '<div class="hallrow"><span class="label">' + esc(area) + (hall ? esc(hall) + 'ホール' : '地区') + '</span><div class="cells">';
        for (const [block, n] of blocks) {
          const level = n >= max * 0.66 ? 3 : n >= max * 0.33 ? 2 : 1;
          const on = state.cell && state.cell.day === day && state.cell.area === area &&
                     state.cell.hall === hall && state.cell.block === block;
          html += '<button class="cell" type="button" data-area="' + esc(area) + '" data-level="' + level +
                  '" data-day="' + day + '" data-hall="' + esc(hall) + '" data-block="' + esc(block) +
                  '" aria-pressed="' + (on ? 'true' : 'false') + '"><b>' + esc(block) + '</b><i>' + n + '</i></button>';
        }
        html += '</div></div>';
      }
    }
    html += '</div>';
  }

  view.querySelector('.cellwrap').innerHTML = html;
  view.querySelector('.clear').hidden = !state.cell;
}

function render() {
  const all = rowsFor(state.tab);
  // マップはマス選択以外の絞り込みを反映する —— 検索した結果の分布が見えないと索引の意味がない
  const base = all.filter(matches);
  renderMap(base);
  const list = base.filter(inCell).sort(state.sort === 'space' ? bySpace : byNewest);
  document.getElementById('count').textContent =
    list.length + ' / ' + all.length + (state.grouped ? ' 組' : ' 件');

  // 見出しとタブの数字もグループ化に追随させる。ここがツイート数のままだと
  // 一覧の件数と食い違って見える
  for (const tab of ['circles', 'cosplayers', 'unclassified']) {
    const n = rowsFor(tab).length;
    document.querySelector('.tab[data-tab="' + tab + '"] .n').textContent = n;
    const stat = document.getElementById('stat-' + tab);
    if (stat) stat.textContent = n;
  }
  document.getElementById('area-filter').hidden = state.tab !== 'circles';

  lastList = list;

  const grid = document.getElementById('grid');
  const twrap = document.getElementById('ltable-wrap');

  if (state.view === 'table') {
    grid.hidden = true;
    twrap.hidden = false;
    twrap.innerHTML = '<table class="ltable"><thead><tr>' +
      '<th>状態</th><th>配置</th><th>サークル</th><th>金額</th><th>メモ</th><th></th>' +
      '</tr></thead><tbody>' + list.map(rowHtml).join('') + '</tbody></table>';
  } else {
    twrap.hidden = true;
    grid.hidden = false;
    grid.innerHTML = list.map(cardHtml).join('');

    // 本文が溢れていなければ「全文を表示」は出さない
    for (const card of grid.children) {
      const body = card.querySelector('.body');
      const more = card.querySelector('.more');
      if (body && more && body.scrollHeight <= body.clientHeight + 2) more.remove();
    }
  }
  document.getElementById('empty').hidden = list.length > 0;
}

let lastList = [];

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
  const posts = DATA[state.tab].filter(e => e.screenName === sn)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (!posts.length) return;
  const head = (state.grouped ? rowsFor(state.tab) : posts).find(e => e.screenName === sn) || posts[0];
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

document.getElementById('view-toggle').addEventListener('click', ev => {
  state.view = state.view === 'cards' ? 'table' : 'cards';
  ev.currentTarget.textContent = state.view === 'cards' ? '表で見る' : 'カードで見る';
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
  render();
  return true;
}

document.getElementById('panel').addEventListener('click', ev => { handleMark(ev); });
document.getElementById('panel').querySelector('.close').addEventListener('click', closePanel);
document.getElementById('backdrop').addEventListener('click', closePanel);
document.getElementById('ltable-wrap').addEventListener('click', ev => {
  if (handleMark(ev)) return;
  const row = ev.target.closest('tr[data-sn]');
  if (row) openPanel(row.dataset.sn);
});

document.getElementById('mapview').addEventListener('click', ev => {
  if (ev.target.closest('.clear')) { state.cell = null; render(); return; }
  const cell = ev.target.closest('.cell');
  if (!cell) return;
  const picked = {
    day: Number(cell.dataset.day),
    area: cell.dataset.area,
    hall: cell.dataset.hall,
    block: cell.dataset.block,
  };
  const same = state.cell && ['day', 'area', 'hall', 'block'].every(k => state.cell[k] === picked[k]);
  state.cell = same ? null : picked;
  render();
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

initSeen([...DATA.circles, ...DATA.cosplayers, ...DATA.unclassified]);
render();
`;

export function renderHtml(dataset: Dataset): string {
    const { stats, event, generatedAt } = dataset;
    const dayChips = event.days
        .map((d) => `<button class="chip" type="button" data-value="${d.day}" aria-pressed="false">${d.label}</button>`)
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
    <button class="tab" type="button" role="tab" data-tab="circles" aria-selected="true">サークル<span class="n">${stats.circles}</span></button>
    <button class="tab" type="button" role="tab" data-tab="cosplayers" aria-selected="false">コスプレイヤー<span class="n">${stats.cosplayers}</span></button>
    <button class="tab" type="button" role="tab" data-tab="unclassified" aria-selected="false">未分類<span class="n">${stats.unclassified}</span></button>
  </nav>

  <div class="toolbar">
    <input id="q" type="search" placeholder="サークル名 / 作者 / キャラ / 作品 / 本文 を検索">
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
    <button class="chip" type="button" id="view-toggle">表で見る</button>
    <span class="spacer"></span>
    <button class="chip" type="button" id="csv-btn" title="今の絞り込み・並び順で書き出します">CSV</button>
    <button class="chip" type="button" id="print-btn" title="今の絞り込み・並び順で印刷します">印刷</button>
    <button class="chip" type="button" id="export-btn" title="チェック・メモをファイルに書き出して別の端末へ">チェックを書き出す</button>
    <button class="chip" type="button" id="import-btn">チェックを読み込む</button>
    <input type="file" id="import-file" accept="application/json" hidden>
    <button class="chip" type="button" id="read-all-btn" title="「新着」の印をすべて消します">すべて既読にする</button>
  </div>

  <section class="mapview" id="mapview" hidden>
    <header>
      <h2>配置マップ</h2>
      <span class="note">採集できた配置のブロック索引です。公式の会場平面図ではありません —
        正確な配置図は <a href="https://webcatalog.circle.ms/" target="_blank" rel="noopener">コミケWebカタログ</a> で確認してください</span>
      <button class="clear" type="button" hidden>選択を解除</button>
    </header>
    <div class="cellwrap"></div>
  </section>

  <div class="grid" id="grid"></div>
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
<script>${JS}</script>
</body>
</html>
`;
}
