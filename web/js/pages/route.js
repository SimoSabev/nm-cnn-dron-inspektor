// Маршрут на повторния полет: три метода, батерия с резерв, симулация на полета и „гонка“ НС срещу ГА.
import { t, onLang } from '../i18n.js';
import { h, topbar, footer, loadDemo, wallView, pct, m2tile, fmt } from '../ui.js';
import { findZones, sortZonesByArea, probsToMap, zonesToProblem, nearestNeighbor, geneticAlgorithm,
  exactSolution, tripEnergy, tripDistance } from '../core.js';

topbar('route.html');
footer();
const app = document.getElementById('app');
const data = await loadDemo();
const R = data.rows, C = data.cols, TM = data.tile_m;
const map = probsToMap(data.probs, data.threshold);
const zones = sortZonesByArea(findZones(map, 8).zones);
const TRIP_COL = ['#4CC3E6', '#A99BFF', '#7BD88F', '#E6E9EC', '#F5A524'];
const S = { method: 'ga', battery: 60, reserve: 0.2, prog: 0, playing: false };
let RES = null, E = {}, timer = null;

function solve() {
  const p = zonesToProblem(zones, R, { tileM: TM, battery: S.battery, reserve: S.reserve });
  const out = { p, routes: {} };
  if (!p.unreachable.length && p.n) {
    out.routes.nn = nearestNeighbor(p);
    out.routes.ga = geneticAlgorithm(p, { seed: 0 });
    if (p.n <= 8) out.routes.exact = exactSolution(p, 8);
  }
  return out;
}

const tilePt = (p, i) => m2tile(p.points[i], R, TM);
const pathD = (p, trip) => 'M' + [0, ...trip, 0].map(i => tilePt(p, i).join(' ')).join(' L');

function legs(p, trips) {
  const out = [];
  trips.forEach((tr, ti) => { const s = [0, ...tr, 0]; for (let k = 0; k + 1 < s.length; k++) out.push({ a: s[k], b: s[k + 1], ti, d: p.dist[s[k]][s[k + 1]] }); });
  return out;
}

function simState(p, trips) {
  const L = legs(p, trips), total = L.reduce((s, l) => s + l.d, 0);
  let rem = S.prog * total, used = 0, ti = 0, pos = p.points[0];
  for (let k = 0; k < L.length; k++) {
    const l = L[k];
    if (k && L[k - 1].ti !== l.ti) used = 0;
    ti = l.ti;
    if (rem <= l.d) { const f = l.d ? rem / l.d : 0, A = p.points[l.a], B = p.points[l.b]; pos = [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]; used += rem; break; }
    rem -= l.d; used += l.d + p.service[l.b]; pos = p.points[l.b];
  }
  return { pos, used, ti };
}

function build() {
  E.tabs = ['nn', 'ga', 'exact'].map(k => h('button', { type: 'button', 'data-k': k, onclick: () => { S.method = k; S.prog = 0; stop(); update(); } }, t('m.' + k)));
  E.wall = wallView({ ...data });
  E.bat = h('input', { id: 'bat', type: 'range', class: 'blue', min: '40', max: '120', step: '1', value: String(S.battery), oninput: e => { S.battery = +e.target.value; RES = solve(); S.prog = 0; update(); } });
  E.batV = h('span', { class: 'mono drone' });
  E.res = h('input', { id: 'res', type: 'checkbox', checked: S.reserve > 0 ? true : null, onchange: e => { S.reserve = e.target.checked ? 0.2 : 0; RES = solve(); S.prog = 0; update(); }, style: 'width:20px;height:20px;accent-color:var(--drone)' });
  E.dist = h('span', { class: 'mono', style: 'font-size:34px;font-weight:600;letter-spacing:-1px' });
  E.gap = h('span', { class: 'mono small' });
  E.trips = h('div', { class: 'stack' });
  E.table = h('tbody');
  E.conv = h('svg', { viewBox: '0 0 240 60', style: 'width:100%;height:60px', role: 'img', 'aria-label': t('rt.conv') });
  E.convTxt = h('span', { class: 'small muted' });
  E.play = h('button', { type: 'button', class: 'btn blue round', onclick: toggle });
  E.prog = h('input', { id: 'prog', type: 'range', class: 'blue', min: '0', max: '1', step: '0.001', value: '0', oninput: e => { stop(); S.prog = +e.target.value; update(); } });
  E.simTxt = h('span', { class: 'mono small muted' });
  E.simBar = h('i');
  E.warn = h('p', { class: 'note bad', hidden: true });

  app.replaceChildren(
    h('div', { class: 'head' },
      h('div', { class: 'stack', style: 'gap:6px' }, h('span', { class: 'small faint' }, t('rt.crumb', { n: zones.length })), h('h1', null, t('rt.title'))),
      h('div', { class: 'seg', role: 'group', 'aria-label': t('rt.method') }, E.tabs)),
    E.warn,
    h('div', { class: 'row' },
      h('section', { class: 'grow3 stack', 'aria-label': t('rt.plan') }, E.wall.el,
        E.legend = h('div', { class: 'small muted', style: 'display:flex;flex-wrap:wrap;gap:16px' }),
        h('div', { class: 'panel row', style: 'align-items:center;gap:16px' }, E.play,
          h('div', { class: 'stack', style: 'flex:1 1 240px;gap:2px' }, h('label', { for: 'prog' }, t('rt.sim')), E.prog),
          h('div', { class: 'stack', style: 'flex:0 1 260px;gap:6px' }, E.simTxt, h('div', { class: 'bar' }, E.simBar)))),
      h('aside', { class: 'grow1 stack', 'aria-label': t('rt.result') },
        h('div', { class: 'panel stack', style: 'gap:8px' },
          h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' }, h('label', { for: 'bat', style: 'font-weight:600;color:var(--text);font-size:14px' }, t('rt.battery')), E.batV),
          E.bat,
          h('label', { for: 'res', style: 'display:flex;gap:10px;align-items:center;min-height:32px' }, E.res, t('rt.reserve'))),
        h('div', { class: 'panel stack' },
          h('div', { style: 'display:flex;justify-content:space-between;align-items:flex-end;gap:12px' }, h('div', { class: 'stack', style: 'gap:2px' }, h('span', { class: 'small faint' }, t('rt.total')), E.dist), E.gap),
          E.trips),
        h('div', { class: 'panel stack' },
          h('span', { class: 'small faint', style: 'text-transform:uppercase;letter-spacing:1px' }, t('rt.compare')),
          h('div', { class: 'scrollx' }, h('table', { class: 'mono small' }, h('thead', null, h('tr', null, h('th', null, t('rt.thMethod')), h('th', null, 'm'), h('th', null, t('rt.thGap')), h('th', null, t('rt.thTime')))), E.table)),
          E.convTxt, E.conv))),
    HAS_RACE ? raceSection() : null,
  );
}

function update() {
  const { p, routes } = RES;
  E.tabs.forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.k === S.method)); b.disabled = !routes[b.dataset.k]; });
  E.batV.textContent = `B = ${S.battery}` + (S.reserve ? ` · ${t('rt.usable')} ${fmt(p.battery, 0)}` : '');
  E.warn.hidden = !p.unreachable.length;
  E.warn.textContent = t('rt.unreachable', { z: p.unreachable.map(i => '#' + i).join(', ') });
  const route = routes[S.method] || routes.ga;
  // стена: само плочките с пукнатина
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) E.wall.cells[r * C + c].style.background = map[r][c] ? 'rgba(245,165,36,.45)' : 'rgba(11,15,19,.45)';
  E.wall.svg.replaceChildren();
  E.wall.labels.replaceChildren();
  if (!route) { E.dist.textContent = '—'; E.trips.replaceChildren(); E.table.replaceChildren(); return; }
  E.legend.replaceChildren(...route.trips.map((_, i) => h('span', null, h('span', { class: 'dot', style: `background:${TRIP_COL[i % 5]};margin-right:6px` }), t('rt.trip', { n: i + 1 }))),
    h('span', null, h('span', { class: 'dot', style: 'background:#E6E9EC;margin-right:6px;border-radius:2px' }), t('rt.base')));
  route.trips.forEach((tr, i) => E.wall.svg.append(h('path', { d: pathD(p, tr), fill: 'none', stroke: TRIP_COL[i % 5], 'stroke-width': '0.16', 'stroke-linejoin': 'round', 'stroke-dasharray': i % 2 ? '0.5 0.3' : null })));
  const b0 = tilePt(p, 0);
  E.wall.svg.append(h('rect', { x: b0[0] - 0.45, y: b0[1] - 0.9, width: '0.9', height: '0.9', rx: '0.15', fill: '#E6E9EC' }));
  zones.forEach((z, i) => { const s = h('span', { class: 'zl' }, '#' + (i + 1)); Object.assign(s.style, pct(z.center, R, C)); E.wall.labels.append(s); });
  // дрон в симулацията
  const sim = simState(p, route.trips), dp = m2tile(sim.pos, R, TM);
  if (S.prog > 0 && S.prog < 1) {
    E.wall.svg.append(h('circle', { cx: dp[0], cy: dp[1], r: '0.7', fill: 'none', stroke: '#fff', 'stroke-width': '0.12' }), h('circle', { cx: dp[0], cy: dp[1], r: '0.28', fill: '#fff' }));
  }
  E.prog.value = String(S.prog);
  E.play.innerHTML = S.playing ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z"/></svg>';
  E.play.setAttribute('aria-label', t(S.playing ? 'rt.pause' : 'rt.play'));
  const live = S.prog > 0 && S.prog < 1, pctUsed = live ? Math.min(100, (sim.used / S.battery) * 100) : 0;
  E.simTxt.textContent = S.prog === 0 ? t('rt.atBase') : S.prog >= 1 ? t('rt.done') : t('rt.inTrip', { n: sim.ti + 1, e: fmt(sim.used), b: S.battery });
  E.simBar.style.cssText = `width:${pctUsed}%;background:${TRIP_COL[sim.ti % 5]}`;

  const best = Math.min(...Object.values(routes).map(r => r.distance));
  E.dist.textContent = fmt(route.distance, 2) + ' m';
  const g = (route.distance / best - 1) * 100;
  E.gap.textContent = g > 0.05 ? t('rt.worse', { g: fmt(g) }) : t('rt.best');
  E.gap.className = 'mono small note ' + (g > 0.05 ? 'warn' : 'info');
  E.trips.replaceChildren(...route.trips.map((tr, i) => {
    const e = tripEnergy(p, tr), share = (e / S.battery) * 100;
    return h('div', { class: 'stack', style: 'gap:6px;padding-top:10px;border-top:1px solid var(--line)' },
      h('div', { style: 'display:flex;justify-content:space-between;font-size:13px' }, h('strong', { style: `color:${TRIP_COL[i % 5]}` }, t('rt.trip', { n: i + 1 })), h('span', { class: 'mono' }, `${fmt(e)} / ${S.battery}`)),
      h('div', { class: 'bar', style: 'height:10px' }, h('i', { style: `width:${Math.min(100, share)}%;background:${TRIP_COL[i % 5]}` }),
        S.reserve ? h('span', { style: `position:absolute;top:0;bottom:0;left:${(1 - S.reserve) * 100}%;width:2px;background:#E6E9EC;opacity:.6` }) : null),
      h('span', { class: 'mono small muted' }, t('rt.seq', { s: tr.map(z => '#' + z).join(' → ') }) + ` · ${fmt(tripDistance(p, tr))} m`));
  }));
  E.table.replaceChildren(...['nn', 'ga', 'exact'].filter(k => routes[k]).map(k => {
    const r = routes[k], gg = (r.distance / best - 1) * 100;
    return h('tr', null, h('td', null, t('m.' + k)), h('td', null, fmt(r.distance, 2)),
      h('td', { class: gg > 0.05 ? 'crack' : 'drone' }, gg > 0.05 ? `+${fmt(gg)} %` : '0 %'), h('td', null, r.ms < 1 ? '<1 ms' : `${fmt(r.ms, 0)} ms`));
  }));
  const hist = routes.ga.history, mx = Math.max(...hist), mn = Math.min(...hist), span = mx - mn || 1;
  E.conv.replaceChildren(h('polyline', { points: hist.map((v, i) => `${(i / Math.max(1, hist.length - 1)) * 240},${54 - ((v - mn) / span) * 48}`).join(' '), fill: 'none', stroke: '#4CC3E6', 'stroke-width': '2' }));
  const convAt = hist.findIndex(v => v <= mn + 1e-9);
  E.convTxt.textContent = t('rt.convTxt', { a: fmt(hist[0], 2), b: fmt(mn, 2), g: convAt, n: hist.length - 1 });
}

function toggle() {
  if (S.playing) { stop(); update(); return; }
  if (S.prog >= 1) S.prog = 0;
  S.playing = true;
  timer = setInterval(() => { S.prog = Math.min(1, S.prog + 0.004); if (S.prog >= 1) stop(); update(); }, 40);
  update();
}
function stop() { clearInterval(timer); S.playing = false; }

// ------------------------------------------------------------------ гонка
const RG = data.race_grid || [[1]], RR = RG.length, RC = RG[0].length, HAS_RACE = !!data.race_grid;
const raceZones = sortZonesByArea(findZones(RG, 8).zones);
const RP = zonesToProblem(raceZones, RR, { tileM: TM, battery: 80 });
const RNN = nearestNeighbor(RP);
const SNAPS = [];
const RGA = geneticAlgorithm(RP, { seed: 0, onImprove: (g, cost, trips) => SNAPS.push({ g, cost, trips }) });
const RGEN = RGA.history.length - 1;
const RS = { gen: 0, playing: false };
let rtimer = null, RE = {};

function racePanel(title, cls) {
  const svg = h('svg', { viewBox: `-1 -1 ${RC + 2} ${RR + 2}`, style: 'width:100%;display:block', role: 'img', 'aria-label': title });
  return { svg, dist: h('span', { class: 'mono', style: 'font-size:24px;font-weight:600' }), sub: h('span', { class: 'mono small ' + cls }), title };
}

function raceSection() {
  RE.nn = racePanel(t('m.nn'), 'faint'); RE.ga = racePanel(t('m.ga'), 'drone');
  RE.slider = h('input', { id: 'gen', type: 'range', class: 'blue', min: '0', max: String(RGEN), step: '1', value: String(RS.gen), oninput: e => { rstop(); RS.gen = +e.target.value; raceUpdate(); } });
  RE.play = h('button', { type: 'button', class: 'btn blue round', onclick: rtoggle });
  RE.chart = h('svg', { viewBox: '-4 -6 640 186', style: 'width:100%;height:auto', role: 'img', 'aria-label': t('rc.chart') });
  RE.diff = h('span', { class: 'mono', style: 'font-size:28px;font-weight:600' });
  const panel = (P, color) => h('div', { class: 'panel stack', style: `border-color:${color}` },
    h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' }, h('strong', null, P.title), P.dist), P.svg, P.sub);
  const sec = h('section', { class: 'stack', style: 'margin-top:24px', 'aria-label': t('rc.title') },
    h('div', { class: 'stack', style: 'gap:6px;max-width:820px' }, h('h2', null, t('rc.title')), h('p', { class: 'muted' }, t('rc.lead', { n: RP.n, w: RC * TM, hh: RR * TM }))),
    h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(520px,100%),1fr));gap:16px' }, panel(RE.nn, 'var(--line)'), panel(RE.ga, '#2E4752')),
    h('div', { class: 'panel row', style: 'align-items:center;gap:20px' }, RE.play,
      h('div', { class: 'stack', style: 'flex:1 1 520px;gap:4px' }, RE.chart, h('label', { for: 'gen' }, t('rc.gen')), RE.slider),
      h('div', { class: 'stack', style: 'flex:0 1 200px;gap:4px' }, h('span', { class: 'small faint' }, t('rc.vs')), RE.diff, h('span', { class: 'small faint' }, t('rc.stop')))));
  queueMicrotask(raceUpdate);
  return sec;
}

function drawRace(P, trips, color) {
  const rects = [];
  for (let r = 0; r < RR; r++) for (let c = 0; c < RC; c++) if (RG[r][c]) rects.push(h('rect', { x: c, y: r, width: '1', height: '1', fill: '#5A4318' }));
  const pt = i => m2tile(RP.points[i], RR, TM);
  const paths = trips.map((tr, i) => h('path', { d: 'M' + [0, ...tr, 0].map(k => pt(k).join(' ')).join(' L'), fill: 'none', stroke: color, 'stroke-width': '0.22', 'stroke-linejoin': 'round', 'stroke-dasharray': ['', '0.8 0.5', '0.25 0.4', '1.4 0.4 0.25 0.4', ''][i % 5] || null }));
  const dots = raceZones.map((z, i) => { const p = pt(i + 1); return h('circle', { cx: p[0], cy: p[1], r: '0.6', fill: '#0E1216', stroke: '#F5A524', 'stroke-width': '0.12' }); });
  const b = pt(0);
  P.svg.replaceChildren(h('rect', { x: 0, y: 0, width: RC, height: RR, fill: '#1B2229', stroke: '#2E3740', 'stroke-width': '0.08' }), ...rects, ...paths, ...dots,
    h('rect', { x: b[0] - 0.8, y: b[1] - 1.6, width: '1.6', height: '1.6', rx: '0.25', fill: '#E6E9EC' }));
}

function raceUpdate() {
  let snap = SNAPS[0];
  for (const s of SNAPS) if (s.g <= RS.gen) snap = s;
  drawRace(RE.nn, RNN.trips, '#8D97A3');
  drawRace(RE.ga, snap.trips, '#4CC3E6');
  RE.nn.dist.textContent = fmt(RNN.distance) + ' m'; RE.nn.sub.textContent = t('rc.nnSub', { k: RNN.trips.length });
  RE.ga.dist.textContent = fmt(snap.cost) + ' m';
  RE.ga.sub.textContent = t('rc.gaSub', { g: RS.gen, k: snap.trips.length, s: t(snap.cost < RNN.distance ? 'rc.leads' : 'rc.behind') });
  const d = (snap.cost / RNN.distance - 1) * 100;
  RE.diff.textContent = (d > 0 ? '+' : '') + fmt(d) + ' %';
  RE.diff.style.color = d < 0 ? 'var(--drone)' : 'var(--crack)';
  RE.slider.value = String(RS.gen);
  const hi = Math.max(SNAPS[0].cost, RNN.distance) * 1.03, lo = Math.min(RGA.distance, RNN.distance) * 0.97;
  const Y = v => ((hi - v) / (hi - lo)) * 160, X = g => (g / RGEN) * 600;
  const pts = []; let prev = null;
  for (const s of SNAPS) { if (prev !== null) pts.push(`${X(s.g)},${Y(prev)}`); pts.push(`${X(s.g)},${Y(s.cost)}`); prev = s.cost; }
  pts.push(`${X(RGEN)},${Y(prev)}`);
  const done = pts.filter(p => +p.split(',')[0] <= X(RS.gen));
  done.push(`${X(RS.gen)},${Y(snap.cost)}`);
  const cross = SNAPS.find(s => s.cost < RNN.distance);
  RE.chart.replaceChildren(
    h('line', { x1: 0, y1: Y(RNN.distance), x2: 600, y2: Y(RNN.distance), stroke: '#8D97A3', 'stroke-dasharray': '6 5' }),
    h('text', { x: 604, y: Y(RNN.distance) + 4, 'font-family': 'JetBrains Mono, monospace', 'font-size': '11', fill: '#8D97A3' }, t('rc.nnShort')),
    h('polyline', { points: pts.join(' '), fill: 'none', stroke: '#2E4752', 'stroke-width': '2' }),
    h('polyline', { points: done.join(' '), fill: 'none', stroke: '#4CC3E6', 'stroke-width': '2.5' }),
    cross ? h('circle', { cx: X(cross.g), cy: Y(RNN.distance), r: '5', fill: 'none', stroke: '#F5A524', 'stroke-width': '2' }) : null,
    cross ? h('text', { x: X(cross.g) + 8, y: Y(RNN.distance) - 10, 'font-family': 'JetBrains Mono, monospace', 'font-size': '11', fill: '#F5A524' }, t('rc.cross', { g: cross.g })) : null,
    h('line', { x1: X(RS.gen), y1: 0, x2: X(RS.gen), y2: 160, stroke: '#E6E9EC' }),
    h('line', { x1: 0, y1: 160, x2: 600, y2: 160, stroke: '#232A32' }));
  RE.play.innerHTML = RS.playing ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z"/></svg>';
  RE.play.setAttribute('aria-label', t(RS.playing ? 'rt.pause' : 'rc.play'));
}
function rtoggle() {
  if (RS.playing) { rstop(); raceUpdate(); return; }
  if (RS.gen >= RGEN) RS.gen = 0;
  RS.playing = true;
  rtimer = setInterval(() => { RS.gen = Math.min(RGEN, RS.gen + 1); if (RS.gen >= RGEN) rstop(); raceUpdate(); }, 45);
  raceUpdate();
}
function rstop() { clearInterval(rtimer); RS.playing = false; }

RES = solve();
build(); update();
onLang(() => { build(); update(); });
