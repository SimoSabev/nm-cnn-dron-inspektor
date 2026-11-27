// Песочница: рисуваш пукнатини, зоните и маршрутът се смятат наново на всяко движение.
import { t, onLang } from '../i18n.js';
import { h, topbar, footer, wallView, pct, m2tile, fmt } from '../ui.js';
import { findZones, sortZonesByArea, zonesToProblem, nearestNeighbor, geneticAlgorithm } from '../core.js';

topbar('sandbox.html');
footer();
const app = document.getElementById('app');
const R = 16, C = 28, TM = 0.5;
const PRESET = [[2,3],[2,4],[2,5],[2,6],[3,14],[4,13],[5,12],[6,11],[7,10],[9,20],[9,21],[9,22],[9,23],[10,24],[12,4],[13,4],[13,5],[14,6],[14,7],[11,15],[12,16],[13,16],[5,25],[6,25],[7,26]];
const S = { grid: blank(), tool: 'draw', painting: false, battery: 60, reserve: 0.2, base: [R - 1, 0], ga: null, seed: 1 };
PRESET.forEach(([r, c]) => { S.grid[r][c] = 1; });
let E = {}, W = null;

function blank() { return Array.from({ length: R }, () => new Array(C).fill(0)); }

function onCell(r, c, e, kind) {
  if (kind === 'down') { S.painting = true; e.preventDefault(); }
  if (!S.painting) return;
  if (S.tool === 'base') { S.base = [r, c]; S.ga = null; update(); return; }
  const v = S.tool === 'draw' ? 1 : 0;
  if (S.grid[r][c] === v) return;
  S.grid[r][c] = v; S.ga = null; update();
}

function problem() {
  const zones = sortZonesByArea(findZones(S.grid, 8).zones);
  const [br, bc] = S.base;
  const p = zonesToProblem(zones, R, { tileM: TM, battery: S.battery, reserve: S.reserve, base: [(bc + 0.5) * TM, (R - br - 0.5) * TM] });
  return { zones, p };
}

function build() {
  W = wallView({ rows: R, cols: C }, { onCell });
  W.el.addEventListener('pointerup', () => { S.painting = false; });
  W.el.addEventListener('pointerleave', () => { S.painting = false; });
  W.el.style.touchAction = 'none'; W.el.style.userSelect = 'none'; W.el.style.background = '#1B2229';
  E.tools = [['draw', 'sb.draw'], ['erase', 'sb.erase'], ['base', 'sb.base']].map(([k, key]) => h('button', { type: 'button', 'data-k': k, onclick: () => { S.tool = k; update(); } }, t(key)));
  E.bat = h('input', { id: 'sbat', type: 'range', class: 'blue', min: '20', max: '120', step: '1', value: String(S.battery), oninput: e => { S.battery = +e.target.value; S.ga = null; update(); } });
  E.batV = h('span', { class: 'mono drone', style: 'font-size:18px' });
  E.res = h('input', { id: 'sres', type: 'checkbox', checked: S.reserve ? true : null, style: 'width:20px;height:20px;accent-color:var(--drone)', onchange: e => { S.reserve = e.target.checked ? 0.2 : 0; S.ga = null; update(); } });
  E.nZones = h('span', { class: 'mono' }); E.nn = h('span', { class: 'mono' }); E.gaT = h('span', { class: 'mono' });
  E.gain = h('p', { class: 'note info', hidden: true }); E.warn = h('p', { class: 'note warn', hidden: true });
  app.replaceChildren(
    h('div', { class: 'head' },
      h('div', { class: 'stack', style: 'gap:6px;max-width:760px' }, h('h1', null, t('sb.title')), h('p', { class: 'muted' }, t('sb.lead'))),
      h('div', { class: 'seg', role: 'group', 'aria-label': t('sb.tool') }, E.tools)),
    h('div', { class: 'row' },
      h('section', { class: 'grow3 stack', 'aria-label': t('an.wall') }, W.el,
        h('div', { class: 'small muted', style: 'display:flex;flex-wrap:wrap;gap:16px' },
          h('span', null, h('span', { class: 'dot', style: 'background:var(--crack);border-radius:2px;margin-right:6px' }), t('sb.legCrack')),
          h('span', null, h('span', { style: 'display:inline-block;width:20px;border-top:2px dashed #8D97A3;margin-right:6px;vertical-align:middle' }), t('m.nn')),
          h('span', null, h('span', { style: 'display:inline-block;width:20px;border-top:3px solid #4CC3E6;margin-right:6px;vertical-align:middle' }), t('m.ga')),
          h('span', null, h('span', { class: 'dot', style: 'background:#E6E9EC;border-radius:2px;margin-right:6px' }), t('rt.base')))),
      h('aside', { class: 'grow1 stack', 'aria-label': t('rt.result') },
        h('div', { class: 'panel stack', style: 'gap:6px' },
          h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' }, h('label', { for: 'sbat', style: 'font-weight:600;color:var(--text);font-size:14px' }, t('rt.battery')), E.batV),
          E.bat, h('label', { for: 'sres', style: 'display:flex;gap:10px;align-items:center;min-height:32px' }, E.res, t('rt.reserve'))),
        h('div', { class: 'panel stack' },
          h('div', { style: 'display:flex;justify-content:space-between' }, h('span', { class: 'muted' }, t('an.kZones')), E.nZones),
          h('div', { style: 'display:flex;justify-content:space-between' }, h('span', { class: 'muted' }, t('m.nn')), E.nn),
          h('div', { style: 'display:flex;justify-content:space-between' }, h('span', { class: 'drone' }, t('m.ga')), E.gaT),
          E.gain, E.warn,
          h('button', { type: 'button', class: 'btn blue', onclick: runGA }, t('sb.runGA'))),
        h('div', { style: 'display:flex;gap:8px' },
          h('button', { type: 'button', class: 'btn', style: 'flex:1', onclick: randomWall }, t('sb.random')),
          h('button', { type: 'button', class: 'btn', style: 'flex:1', onclick: () => { S.grid = blank(); S.ga = null; update(); } }, t('sb.clear'))))));
}

function runGA() {
  const { p } = problem();
  if (!p.n || p.unreachable.length) return;
  S.ga = geneticAlgorithm(p, { seed: S.seed++ });
  update();
}

function randomWall() {
  S.grid = blank();
  for (let k = 0; k < 7; k++) {
    let r = Math.floor(Math.random() * R), c = Math.floor(Math.random() * C);
    const dr = [-1, 0, 1][Math.floor(Math.random() * 3)], dc = [-1, 1, 1, 0][Math.floor(Math.random() * 4)] || 1;
    const len = 2 + Math.floor(Math.random() * 5);
    for (let s = 0; s < len && r >= 0 && r < R && c >= 0 && c < C; s++) { S.grid[r][c] = 1; r += dr; c += dc; }
  }
  S.ga = null; update();
}

function update() {
  const { zones, p } = problem();
  E.tools.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === S.tool)));
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const cell = W.cells[r * C + c];
    cell.style.background = S.grid[r][c] ? 'var(--crack)' : 'transparent';
    cell.style.cursor = 'crosshair';
  }
  E.batV.textContent = String(S.battery);
  const nn = p.n && !p.unreachable.length ? nearestNeighbor(p) : null;
  const pt = i => m2tile(p.points[i], R, TM);
  const path = trips => trips.map(tr => 'M' + [0, ...tr, 0].map(i => pt(i).join(' ')).join(' L')).join(' ');
  const b = pt(0);
  W.svg.replaceChildren(
    nn ? h('path', { d: path(nn.trips), fill: 'none', stroke: '#8D97A3', 'stroke-width': '0.08', 'stroke-dasharray': '0.25 0.18', 'stroke-linejoin': 'round', opacity: S.ga ? '0.7' : '1' }) : '',
    S.ga ? h('path', { d: path(S.ga.trips), fill: 'none', stroke: '#4CC3E6', 'stroke-width': '0.12', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }) : '',
    h('rect', { x: b[0] - 0.4, y: b[1] - 0.4, width: '0.8', height: '0.8', rx: '0.12', fill: '#E6E9EC' }));
  W.labels.replaceChildren(...zones.map((z, i) => {
    const s = h('span', { class: 'zl', style: 'transform:translate(-50%,-140%)' }, '#' + (i + 1));
    Object.assign(s.style, pct(z.center, R, C)); return s;
  }));
  E.nZones.textContent = p.n;
  E.nn.textContent = nn ? t('sb.res', { d: fmt(nn.distance), k: nn.trips.length }) : '—';
  E.gaT.textContent = S.ga ? t('sb.res', { d: fmt(S.ga.distance), k: S.ga.trips.length }) : t('sb.notRun');
  E.gain.hidden = !(S.ga && nn);
  if (S.ga && nn) E.gain.textContent = t('sb.gain', { g: fmt((1 - S.ga.distance / nn.distance) * 100), n: S.ga.generations, ms: fmt(S.ga.ms, 0) });
  E.warn.hidden = !p.unreachable.length;
  E.warn.textContent = t('sb.unreach', { z: p.unreachable.map(i => '#' + i).join(', ') });
}

build(); update();
onLang(() => { build(); update(); });
