// Анализ на стената: слоеве (снимка / ŷ / карта 0/1 / зони), праг на живо, зони по площ.
import { t, onLang } from '../i18n.js';
import { h, topbar, footer, loadDemo, wallView, pct, fmt } from '../ui.js';
import { findZones, sortZonesByArea, probsToMap } from '../core.js';

topbar('analysis.html');
footer();
const app = document.getElementById('app');
const data = await loadDemo();
const P = data.probs, R = data.rows, C = data.cols, TM = data.tile_m, THR0 = data.threshold;
const S = { thr: THR0, mode: 'zones', sel: 1 };
const W = wallView(data);
let E = {};

function compute() {
  const map = probsToMap(P, S.thr);
  const { zones: raw, labels } = findZones(map, 8);
  const zones = sortZonesByArea(raw);
  const rank = {}; zones.forEach((z, i) => { rank[z.id] = i + 1; });
  let nCells = 0, missed = 0, extra = 0;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const a = P[r][c] >= S.thr, b = P[r][c] >= THR0;
    if (a) nCells++; if (b && !a) missed++; if (a && !b) extra++;
  }
  return { zones, labels, rank, nCells, missed, extra };
}

function build() {
  const modes = [['photo', 'layer.photo'], ['prob', 'layer.prob'], ['bin', 'layer.bin'], ['zones', 'layer.zones']];
  E.modeBtns = modes.map(([k, key]) => h('button', { type: 'button', onclick: () => { S.mode = k; update(); } , 'data-k': k }, t(key)));
  E.slider = h('input', { id: 'thr', type: 'range', min: '0.05', max: '0.95', step: '0.01', value: String(S.thr),
    oninput: e => { S.thr = parseFloat(e.target.value); S.sel = 1; update(); } });
  E.thrText = h('span', { class: 'mono crack', style: 'font-size:20px' });
  E.delta = h('p', { class: 'note' });
  E.kCells = h('span', { class: 'v' }); E.kZones = h('span', { class: 'v' }); E.kArea = h('span', { class: 'v' });
  E.zoom = h('div', { style: 'height:170px;background-color:#2A2E33;background-repeat:no-repeat;border-bottom:1px solid var(--line)', role: 'img', 'aria-label': t('an.zoomAlt') });
  E.selTitle = h('strong', { style: 'font-size:16px' }); E.selP = h('span', { class: 'mono small crack' });
  E.selInfo = h('span', { class: 'mono small muted' }); E.selPos = h('span', { class: 'mono small muted' });
  E.list = h('div', { class: 'list' });
  E.source = h('span', { class: 'badge-sim' }, t(data.source === 'cnn' ? 'src.cnn' : 'src.demo'));

  app.replaceChildren(
    h('div', { class: 'head' },
      h('div', { class: 'stack', style: 'gap:6px' },
        h('span', { class: 'small faint' }, t('an.crumb')),
        h('div', { style: 'display:flex;gap:12px;align-items:center;flex-wrap:wrap' }, h('h1', null, t('an.title')), E.source),
        h('span', { class: 'mono small muted' }, t('an.meta', { r: R, c: C, m: TM, w: C * TM, hh: R * TM }))),
      h('a', { class: 'btn primary', href: 'route.html' }, t('an.toRoute'), ' →')),
    h('div', { class: 'row' },
      h('section', { class: 'grow3 stack', 'aria-label': t('an.wall') },
        h('div', { class: 'head' }, h('div', { class: 'seg', role: 'group', 'aria-label': t('an.layer') }, E.modeBtns), h('span', { class: 'small faint' }, t('an.clickHint'))),
        W.el,
        h('div', { class: 'panel row', style: 'align-items:center;gap:20px' },
          h('div', { class: 'stack', style: 'flex:1 1 320px;gap:6px' },
            h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' }, h('label', { for: 'thr', style: 'font-weight:600;color:var(--text);font-size:14px' }, t('an.thr')), E.thrText),
            E.slider,
            h('div', { class: 'mono small faint', style: 'display:flex;justify-content:space-between' }, h('span', null, t('an.thrLow')), h('span', null, t('an.thrHigh')))),
          h('div', { class: 'stack', style: 'flex:1 1 260px;gap:8px' }, E.delta,
            h('button', { type: 'button', class: 'btn', style: 'height:36px;align-self:flex-start;font-size:13px', onclick: () => { S.thr = THR0; S.sel = 1; E.slider.value = String(THR0); update(); } }, t('an.reset', { v: THR0 }))))),
      h('aside', { class: 'grow1 stack', 'aria-label': t('an.zonesTitle') },
        h('div', { class: 'kpis' },
          h('div', { class: 'kpi' }, h('span', { class: 'l' }, t('an.kCells')), E.kCells),
          h('div', { class: 'kpi' }, h('span', { class: 'l' }, t('an.kZones')), E.kZones),
          h('div', { class: 'kpi' }, h('span', { class: 'l' }, t('an.kArea')), E.kArea)),
        h('div', { class: 'panel', style: 'padding:0;overflow:hidden' }, E.zoom,
          h('div', { class: 'stack', style: 'padding:14px 16px;gap:6px;border-bottom:1px solid var(--line)' },
            h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' }, E.selTitle, E.selP), E.selInfo, E.selPos),
          h('div', { class: 'small faint', style: 'padding:12px 16px 6px;display:flex;justify-content:space-between;text-transform:uppercase;letter-spacing:1px' }, h('span', null, t('an.sorted')), h('span', null, 'merge sort')),
          h('div', { style: 'padding:0 8px 8px' }, E.list)))),
  );
}

function update() {
  const X = compute();
  const sel = Math.min(S.sel, X.zones.length) || 0;
  E.modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === S.mode)));
  E.thrText.textContent = S.thr.toFixed(2);
  E.slider.value = String(S.thr);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const p = P[r][c], hit = p >= S.thr, zn = X.labels[r][c] ? X.rank[X.labels[r][c]] : 0;
    let bg = 'transparent';
    if (S.mode === 'prob' && p > 0.05) bg = `rgba(245,165,36,${(p * 0.85).toFixed(2)})`;
    if (S.mode === 'bin') bg = hit ? 'rgba(245,165,36,.78)' : 'rgba(11,15,19,.45)';
    if (S.mode === 'zones') bg = hit ? (zn === sel ? 'rgba(255,214,140,.85)' : 'rgba(245,165,36,.5)') : 'rgba(11,15,19,.25)';
    const cell = W.cells[r * C + c];
    cell.style.background = bg;
    cell.style.boxShadow = S.mode === 'photo' ? 'none' : '';
  }
  W.labels.replaceChildren();
  if (S.mode === 'bin' || S.mode === 'zones') {
    X.zones.forEach((z, i) => {
      const b = h('button', { type: 'button', class: 'zl' + (i + 1 === sel ? ' sel' : ''), 'aria-label': t('an.zone', { n: i + 1 }), onclick: () => { S.sel = i + 1; update(); } }, '#' + (i + 1));
      Object.assign(b.style, pct(z.center, R, C), { pointerEvents: 'auto' });
      W.labels.append(b);
    });
  }
  E.kCells.textContent = X.nCells; E.kZones.textContent = X.zones.length; E.kArea.textContent = (X.nCells * TM * TM).toFixed(1) + ' m²';
  if (X.missed) { E.delta.className = 'note warn'; E.delta.textContent = t('an.missed', { n: X.missed }); }
  else if (X.extra) { E.delta.className = 'note info'; E.delta.textContent = t('an.extra', { n: X.extra }); }
  else { E.delta.className = 'note'; E.delta.style.color = 'var(--muted)'; E.delta.textContent = t('an.recommended'); }

  const maxA = X.zones.length ? X.zones[0].area : 1;
  E.list.replaceChildren(...X.zones.map((z, i) => {
    const maxP = Math.max(...z.cells.map(([a, b]) => P[a][b]));
    return h('button', { type: 'button', 'aria-pressed': String(i + 1 === sel), onclick: () => { S.sel = i + 1; update(); } },
      h('span', { class: 'mono crack', style: 'width:32px;font-weight:600' }, '#' + (i + 1)),
      h('span', { style: 'flex:1' }, h('span', { class: 'bar', style: 'display:block;height:6px' }, h('i', { style: `width:${Math.max(8, (z.area / maxA) * 100)}%;background:${i + 1 === sel ? 'var(--crack)' : 'var(--crack-dim)'}` }))),
      h('span', { class: 'mono', style: 'width:64px;text-align:right' }, t('an.tiles', { n: z.area })),
      h('span', { class: 'mono faint', style: 'width:44px;text-align:right' }, maxP.toFixed(2)));
  }));

  const z = X.zones[sel - 1];
  if (z) {
    const [r0, c0, r1, c1] = z.bbox, Wb = E.zoom.clientWidth || 340, Hb = 170, wc = c1 - c0 + 3, hc = r1 - r0 + 3, px = 40;
    const s = Math.min(Wb / (wc * px), Hb / (hc * px));
    E.zoom.style.backgroundImage = `url(${data.image})`;
    E.zoom.style.backgroundSize = `${C * px * s}px ${R * px * s}px`;
    E.zoom.style.backgroundPosition = `${(Wb - wc * px * s) / 2 - (c0 - 1) * px * s}px ${(Hb - hc * px * s) / 2 - (r0 - 1) * px * s}px`;
    E.selTitle.textContent = t('an.zone', { n: sel });
    E.selP.textContent = t('an.maxP', { p: Math.max(...z.cells.map(([a, b]) => P[a][b])).toFixed(2) });
    E.selInfo.textContent = t('an.zoneInfo', { a: z.area, m2: fmt(z.area * TM * TM, 2), r: `${r0}–${r1}`, c: `${c0}–${c1}` });
    E.selPos.textContent = t('an.zonePos', { x: fmt(z.center[1] * TM, 2), y: fmt((R - z.center[0]) * TM, 2) });
  } else {
    E.zoom.style.backgroundImage = 'none';
    E.selTitle.textContent = t('an.noZones'); E.selP.textContent = ''; E.selInfo.textContent = ''; E.selPos.textContent = '';
  }
}

build(); update();
onLang(() => { build(); update(); });
window.addEventListener('resize', update);
