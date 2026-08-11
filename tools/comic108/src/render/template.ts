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

.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(94px, 1fr)); gap: 5px; }
.shots img {
  width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 7px;
  cursor: zoom-in; background: var(--surface-2); border: 1px solid var(--border);
}

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

const state = { tab: 'circles', q: '', days: new Set(), areas: new Set(), mediaOnly: false };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const thumb = m => m.dataUri || (m.url.includes('pbs.twimg.com') ? m.url + '?name=small' : m.url);
const full  = m => m.dataUri || (m.url.includes('pbs.twimg.com') ? m.url + '?name=large' : m.url);

/** 一条记录参与搜索的全部文本 */
function haystack(e) {
  return [
    e.displayName, e.screenName, e.circleName, e.text,
    (e.works || []).join(' '), (e.characters || []).join(' '),
    (e.series || []).join(' '), (e.locations || []).join(' '),
    (e.booths || []).map(b => b.display + ' ' + b.raw).join(' '),
  ].filter(Boolean).join(' ').toLowerCase();
}

const entryDays  = e => e.days || [...new Set((e.booths || []).map(b => b.day).filter(Boolean))];
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
  return true;
}

function boothHtml(e) {
  const bs = e.booths || [];
  if (!bs.length) return '<div class="booth"><span class="b unknown">配置 未取得</span></div>';
  return '<div class="booth">' + bs.map(b =>
    '<span class="b"' + (b.area ? ' data-area="' + esc(b.area) + '"' : '') + '>' + esc(b.display) + '</span>' +
    (b.inherited
      ? '<span class="flag" title="このツイート自体には配置が書かれておらず、同じアカウントの別ツイートから引き継ぎました">別ツイートより</span>'
      : b.confidence === 'low' ? '<span class="flag" title="一部しか読み取れていません">要確認</span>' : '')
  ).join('') + '</div>';
}

function shotsHtml(e) {
  if (!e.media || !e.media.length) return '';
  // 画像が消えている(削除済み・オフライン)場合は枠ごと隠す。壊れたアイコンを並べても仕方ない
  return '<div class="shots">' + e.media.map(m =>
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

  let html = '<div class="foot">' + (bits.length ? '<span>' + bits.join(' · ') + '</span>' : '');
  if (e.charactersConfidence === 'low' && (e.characters || []).length)
    html += '<span class="flag" title="本文からの推定です">キャラ推定</span>';
  return html + '<a class="src" href="' + esc(e.url) + '" target="_blank" rel="noopener">原文 ↗</a></div>';
}

function cardHtml(e) {
  const area = entryAreas(e)[0];
  return '<article class="card"' + (area ? ' data-area="' + esc(area) + '"' : '') + '>' +
    (e.kind === 'circle' ? boothHtml(e) : '') +
    whoHtml(e) + tagsHtml(e) +
    (e.text ? '<div class="body">' + esc(e.text) + '</div><button class="more" type="button">全文を表示</button>' : '') +
    shotsHtml(e) + footHtml(e) +
  '</article>';
}

function render() {
  const list = DATA[state.tab].filter(matches);
  document.getElementById('count').textContent = list.length + ' / ' + DATA[state.tab].length + ' 件';
  document.getElementById('area-filter').hidden = state.tab !== 'circles';

  const grid = document.getElementById('grid');
  grid.innerHTML = list.map(cardHtml).join('');
  document.getElementById('empty').hidden = list.length > 0;

  // 本文が溢れていなければ「全文を表示」は出さない
  for (const card of grid.children) {
    const body = card.querySelector('.body');
    const more = card.querySelector('.more');
    if (body && more && body.scrollHeight <= body.clientHeight + 2) more.remove();
  }
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

document.getElementById('media-only').addEventListener('click', ev => {
  state.mediaOnly = !state.mediaOnly;
  ev.currentTarget.setAttribute('aria-pressed', String(state.mediaOnly));
  render();
});

const lightbox = document.getElementById('lightbox');
document.getElementById('grid').addEventListener('click', ev => {
  if (ev.target.matches('.more')) {
    const body = ev.target.previousElementSibling;
    body.classList.toggle('open');
    ev.target.textContent = body.classList.contains('open') ? '折りたたむ' : '全文を表示';
    return;
  }
  if (ev.target.tagName === 'IMG') {
    lightbox.querySelector('img').src = ev.target.dataset.full;
    lightbox.classList.add('on');
  }
});
lightbox.addEventListener('click', () => lightbox.classList.remove('on'));
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') lightbox.classList.remove('on'); });

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
      <div class="stat"><b>${stats.circles}</b><span>サークル</span></div>
      <div class="stat"><b>${stats.cosplayers}</b><span>コスプレイヤー</span></div>
      <div class="stat"><b>${stats.unclassified}</b><span>未分類</span></div>
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
    <div class="chips"><button class="chip" type="button" id="media-only" aria-pressed="false">画像あり</button></div>
    <span class="count" id="count"></span>
  </div>

  <div class="grid" id="grid"></div>
  <div class="empty" id="empty" hidden>条件に合う項目がありません</div>
</div>

<div id="lightbox"><img alt=""></div>

<script type="application/json" id="c108-data">${embedJson(dataset)}</script>
<script>${JS}</script>
</body>
</html>
`;
}
