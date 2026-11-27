// Общи помощни функции за страниците. Shared helpers for the pages.
import { t, getLang, setLang, onLang, applyStatic } from './i18n.js';

/** h('div', {class: 'x', onclick: f}, 'текст', child) → DOM елемент. */
export function h(tag, attrs, ...kids) {
  const svg = ['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'g', 'text', 'defs', 'marker', 'polygon'].includes(tag);
  const el = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

export const DRONE_SVG = '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="6" cy="6" r="3.5"/><circle cx="22" cy="6" r="3.5"/><circle cx="6" cy="22" r="3.5"/><circle cx="22" cy="22" r="3.5"/><path d="M9 9l3.5 3.5M19 9l-3.5 3.5M9 19l3.5-3.5M19 19l-3.5-3.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/></svg>';

const PAGES = [
  ['monitor.html', 'nav.monitor'], ['analysis.html', 'nav.analysis'], ['route.html', 'nav.route'],
  ['field.html', 'nav.field'], ['sandbox.html', 'nav.sandbox'], ['how.html', 'nav.how'],
];

/** Шапка с навигация и превключвател на езика. */
export function topbar(active) {
  const bar = document.getElementById('top');
  const draw = () => {
    bar.replaceChildren(
      h('a', { class: 'brand', href: 'index.html', html: `<span class="crack">${DRONE_SVG}</span><span>${t('brand')}</span>` }),
      h('nav', { class: 'nav', 'aria-label': t('nav.label') }, PAGES.map(([href, key]) =>
        h('a', { href, 'aria-current': href === active ? 'page' : null }, t(key)))),
      h('div', { class: 'lang', role: 'group', 'aria-label': t('lang.label') }, ['bg', 'en'].map(l =>
        h('button', { type: 'button', 'aria-pressed': String(getLang() === l), onclick: () => setLang(l) }, l.toUpperCase()))),
    );
  };
  bar.classList.add('topbar');
  draw();
  onLang(draw);
  applyStatic();
}

let demoCache = null;
/** Демо данните (или истинските от CNN, когато бъдат експортирани в същия формат). */
export async function loadDemo() {
  if (!demoCache) demoCache = fetch('data/demo.json').then(r => r.json());
  return demoCache;
}

/** Стена със снимка и решетка от плочки. Връща контейнера и масив от клетките. */
export function wallView(data, { onCell } = {}) {
  const { rows, cols } = data;
  const grid = h('div', { class: 'grid', style: `grid-template-columns:repeat(${cols},minmax(0,1fr));grid-template-rows:repeat(${rows},minmax(0,1fr))` });
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const d = h('div', onCell ? { onpointerdown: e => onCell(r, c, e, 'down'), onpointerenter: e => onCell(r, c, e, 'enter') } : null);
    cells.push(d); grid.append(d);
  }
  const svg = h('svg', { class: 'over', viewBox: `0 0 ${cols} ${rows}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const labels = h('div', { style: 'position:absolute;inset:0;pointer-events:none' });
  const el = h('div', { class: 'wall', style: `aspect-ratio:${cols}/${rows}` },
    data.image ? h('img', { src: data.image, alt: t('wall.alt') }) : null, grid, svg, labels);
  return { el, cells, svg, labels, rows, cols };
}

/** Позиция в % върху стената от координати на плочките (ред, колона като в Zone.center). */
export const pct = (rc, rows, cols) => ({ left: (rc[1] / cols) * 100 + '%', top: (rc[0] / rows) * 100 + '%' });

/** Метри (x вдясно, y нагоре от долния ляв ъгъл) → координати на плочките за SVG (колона, ред). */
export const m2tile = ([x, y], rows, tileM) => [x / tileM, rows - y / tileM];

export function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  return 'T+' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(d));

export function storageGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
}
export function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}

export function footer() {
  const f = document.getElementById('foot');
  if (!f) return;
  const draw = () => f.replaceChildren(
    h('span', null, t('foot.data')),
    h('a', { href: 'https://github.com/SimoSabev/nm-cnn-dron-inspektor', class: 'muted' }, 'github.com/SimoSabev/nm-cnn-dron-inspektor'));
  f.classList.add('foot');
  draw(); onLang(draw);
}
