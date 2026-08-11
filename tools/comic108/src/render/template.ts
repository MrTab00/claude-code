/**
 * 单文件 HTML 模板。数据以 JSON 内嵌, CSS/JS 全内联, 零外部依赖。
 * 双击即开, 也能直接发给别人。
 */

import type { Dataset } from '../types';

/** JSON 内嵌进 <script> 时必须把 < 转义掉, 否则 "</script>" 会提前闭合标签 */
function embedJson(data: unknown): string {
    return JSON.stringify(data).replace(/</g, '\\u003c');
}

const CSS = `
:root {
  color-scheme: light dark;
  --bg: #f6f7f9;
  --surface: #ffffff;
  --border: #e3e6ea;
  --text: #16181c;
  --muted: #667080;
  --accent: #0f6fdb;
  --accent-soft: #e7f0fd;
  --warn: #b06000;
  --warn-soft: #fdf1e0;
  --shadow: 0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.04);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1115;
    --surface: #171a20;
    --border: #262b33;
    --text: #e6e8eb;
    --muted: #8b95a5;
    --accent: #5ea1ff;
    --accent-soft: #17263c;
    --warn: #e0a35c;
    --warn-soft: #2c2418;
    --shadow: none;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.6 system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", "Segoe UI", sans-serif;
}
.wrap { max-width: 1280px; margin: 0 auto; padding: 20px 16px 64px; }

header h1 { font-size: 20px; margin: 0 0 4px; }
header .meta { color: var(--muted); font-size: 13px; }

.tabs { display: flex; gap: 6px; margin: 20px 0 12px; flex-wrap: wrap; }
.tab {
  padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border);
  background: var(--surface); color: var(--text); cursor: pointer; font-size: 14px;
}
.tab[aria-selected="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
.tab .n { opacity: .65; margin-left: 6px; font-variant-numeric: tabular-nums; }

.toolbar {
  display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
  padding: 12px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; margin-bottom: 16px; box-shadow: var(--shadow);
}
.toolbar input[type=search] {
  flex: 1 1 240px; min-width: 0; padding: 8px 12px; font-size: 14px;
  border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg); color: var(--text);
}
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip {
  padding: 6px 11px; border-radius: 999px; border: 1px solid var(--border);
  background: var(--bg); color: var(--muted); cursor: pointer; font-size: 13px;
}
.chip[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.count { margin-left: auto; color: var(--muted); font-size: 13px; white-space: nowrap; }

.grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  padding: 14px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px;
}
.booth {
  font-size: 17px; font-weight: 700; letter-spacing: .01em;
  display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.booth .b { background: var(--accent-soft); color: var(--accent); padding: 3px 9px; border-radius: 7px; }
.booth .unknown { background: transparent; color: var(--muted); font-weight: 500; font-size: 14px; padding: 0; }
.who { font-size: 13px; color: var(--muted); }
.who a { color: var(--accent); text-decoration: none; }
.who a:hover { text-decoration: underline; }
.tags { display: flex; gap: 5px; flex-wrap: wrap; }
.tag { font-size: 12px; padding: 3px 8px; border-radius: 6px; background: var(--bg); border: 1px solid var(--border); }
.tag.series { color: var(--muted); }
.body { font-size: 13.5px; white-space: pre-wrap; word-break: break-word; color: var(--text); max-height: 7.6em; overflow: hidden; position: relative; }
.body.open { max-height: none; }
.more { align-self: flex-start; background: none; border: none; color: var(--accent); cursor: pointer; font-size: 12.5px; padding: 0; }
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
.shots img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; cursor: zoom-in; background: var(--bg); border: 1px solid var(--border); }
.foot { display: flex; gap: 10px; align-items: center; font-size: 12px; color: var(--muted); margin-top: auto; }
.foot a { color: var(--accent); text-decoration: none; }
.flag {
  font-size: 11px; padding: 2px 7px; border-radius: 5px;
  background: var(--warn-soft); color: var(--warn); border: 1px solid transparent;
}
.empty { text-align: center; color: var(--muted); padding: 56px 16px; }

#lightbox {
  position: fixed; inset: 0; background: rgba(0,0,0,.86); display: none;
  align-items: center; justify-content: center; z-index: 50; cursor: zoom-out; padding: 24px;
}
#lightbox.on { display: flex; }
#lightbox img { max-width: 100%; max-height: 100%; border-radius: 8px; }

@media (max-width: 560px) {
  .wrap { padding: 14px 10px 48px; }
  .grid { grid-template-columns: 1fr; }
  .count { margin-left: 0; width: 100%; }
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

function entryDays(e) {
  if (e.days) return e.days;
  return [...new Set((e.booths || []).map(b => b.day).filter(Boolean))];
}

function entryAreas(e) {
  return [...new Set((e.booths || []).map(b => b.area).filter(Boolean))];
}

function matches(e) {
  if (state.q && !haystack(e).includes(state.q)) return false;
  if (state.mediaOnly && !(e.media && e.media.length)) return false;

  if (state.days.size) {
    const d = entryDays(e);
    // 日程不明的条目在筛选时保留 —— 宁可多显示, 也不要因为解析不出就藏起来
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
  if (!bs.length) return '<div class="booth"><span class="unknown">配置 未取得</span></div>';
  return '<div class="booth">' + bs.map(b =>
    '<span class="b">' + esc(b.display) + '</span>' +
    (b.confidence === 'low' ? '<span class="flag" title="部分項目しか読み取れていません">要確認</span>' : '')
  ).join('') + '</div>';
}

function shotsHtml(e) {
  if (!e.media || !e.media.length) return '';
  // 画像が消えている(削除済み・オフライン)場合は枠ごと隠す。壊れたアイコンを並べても仕方ない
  return '<div class="shots">' + e.media.map(m =>
    '<img loading="lazy" onerror="this.remove()" src="' + esc(thumb(m)) + '" data-full="' + esc(full(m)) + '" alt="">'
  ).join('') + '</div>';
}

function bodyHtml(e) {
  if (!e.text) return '';
  return '<div class="body">' + esc(e.text) + '</div>' +
         '<button class="more" type="button">全文を表示</button>';
}

function whoHtml(e) {
  return '<div class="who">' +
    (e.circleName ? '<strong>' + esc(e.circleName) + '</strong>' +
      (e.circleNameConfidence === 'low' ? ' <span class="flag" title="サークル名は推定です">推定</span>' : '') + ' · ' : '') +
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
  if (e.charactersConfidence === 'low' && (e.characters || []).length)
    bits.push('<span class="flag" title="本文からの推定です">キャラ推定</span>');

  return '<div class="foot">' + bits.join(' · ') +
    '<a href="' + esc(e.url) + '" target="_blank" rel="noopener" style="margin-left:auto">原文 ↗</a></div>';
}

function cardHtml(e) {
  const head = e.kind === 'circle' ? boothHtml(e) : '';
  return '<article class="card">' + head + whoHtml(e) + tagsHtml(e) + bodyHtml(e) + shotsHtml(e) + footHtml(e) + '</article>';
}

function render() {
  const list = DATA[state.tab].filter(matches);
  document.getElementById('count').textContent = list.length + ' / ' + DATA[state.tab].length + ' 件';
  document.getElementById('area-filter').style.display = state.tab === 'circles' ? '' : 'none';

  const grid = document.getElementById('grid');
  grid.innerHTML = list.length
    ? list.map(cardHtml).join('')
    : '';
  document.getElementById('empty').style.display = list.length ? 'none' : '';

  // 正文没溢出就不显示「全文を表示」
  for (const card of grid.children) {
    const body = card.querySelector('.body');
    const more = card.querySelector('.more');
    if (body && more && body.scrollHeight <= body.clientHeight + 2) more.remove();
  }
}

function bindToggle(container, set, key) {
  container.addEventListener('click', ev => {
    const chip = ev.target.closest('.chip');
    if (!chip) return;
    const value = key === 'day' ? Number(chip.dataset.value) : chip.dataset.value;
    if (set.has(value)) set.delete(value); else set.add(value);
    chip.setAttribute('aria-pressed', set.has(value));
    render();
  });
}

document.querySelector('.tabs').addEventListener('click', ev => {
  const tab = ev.target.closest('.tab');
  if (!tab) return;
  state.tab = tab.dataset.tab;
  for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', t === tab);
  render();
});

document.getElementById('q').addEventListener('input', ev => {
  state.q = ev.target.value.trim().toLowerCase();
  render();
});

bindToggle(document.getElementById('day-filter'), state.days, 'day');
bindToggle(document.getElementById('area-filter'), state.areas, 'area');

document.getElementById('media-only').addEventListener('click', ev => {
  state.mediaOnly = !state.mediaOnly;
  ev.currentTarget.setAttribute('aria-pressed', state.mediaOnly);
  render();
});

const lightbox = document.getElementById('lightbox');
document.getElementById('grid').addEventListener('click', ev => {
  if (ev.target.matches('.more')) {
    ev.target.previousElementSibling.classList.toggle('open');
    ev.target.textContent = ev.target.previousElementSibling.classList.contains('open') ? '折りたたむ' : '全文を表示';
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
        .map((d) => `<button class="chip" data-value="${d.day}" aria-pressed="false">${d.label}</button>`)
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
  <header>
    <h1>${event.name} 情報まとめ</h1>
    <div class="meta">
      生成 ${new Date(generatedAt).toLocaleString('ja-JP')} ·
      ツイート ${stats.tweets} 件から ·
      人工修正 ${stats.overridesApplied} 件適用
    </div>
  </header>

  <nav class="tabs" role="tablist">
    <button class="tab" role="tab" data-tab="circles" aria-selected="true">サークル<span class="n">${stats.circles}</span></button>
    <button class="tab" role="tab" data-tab="cosplayers" aria-selected="false">コスプレイヤー<span class="n">${stats.cosplayers}</span></button>
    <button class="tab" role="tab" data-tab="unclassified" aria-selected="false">未分類<span class="n">${stats.unclassified}</span></button>
  </nav>

  <div class="toolbar">
    <input id="q" type="search" placeholder="サークル名 / 作者 / キャラ / 作品 / 本文 を検索">
    <div class="chips" id="day-filter">${dayChips}</div>
    <div class="chips" id="area-filter">
      <button class="chip" data-value="東" aria-pressed="false">東</button>
      <button class="chip" data-value="西" aria-pressed="false">西</button>
      <button class="chip" data-value="南" aria-pressed="false">南</button>
    </div>
    <div class="chips"><button class="chip" id="media-only" aria-pressed="false">画像あり</button></div>
    <span class="count" id="count"></span>
  </div>

  <div class="grid" id="grid"></div>
  <div class="empty" id="empty" style="display:none">条件に合う項目がありません</div>
</div>

<div id="lightbox"><img alt=""></div>

<script type="application/json" id="c108-data">${embedJson(dataset)}</script>
<script>${JS}</script>
</body>
</html>
`;
}
