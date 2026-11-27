// Мониторинг на мисията: стена на живо, телеметрия, ултразвуков далекомер, конвейер, графики, журнал.
import { t, onLang } from '../i18n.js';
import { h, topbar, footer, loadDemo, wallView, pct, m2tile, fmt, fmtClock, DRONE_SVG } from '../ui.js';
import { Mission, SIM } from '../sim.js';

topbar('monitor.html');
footer();
const app = document.getElementById('app');
const data = await loadDemo();
const R = data.rows, C = data.cols, TM = data.tile_m, THR = data.threshold;
const M = new Mission(data);
const S = { playing: false, speed: 1 };
let E = {}, W = null, timer = null;
const PH = { scan: 0, home: 1, analysis: 1, reflight: 2, done: 3, aborted: 3 };
const DOT = { crack: '#F5A524', zone: '#FFD58A', warn: '#E5484D', ok: '#7BD88F', info: '#5C6773' };
const PLAY = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z"/></svg>';
const PAUSE = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>';

function kpi(labelKey) {
  const v = h('span', { class: 'v' }), hint = h('span', { class: 'h' });
  return { el: h('div', { class: 'kpi' }, h('span', { class: 'l' }, t(labelKey)), v, hint), v, hint };
}

function build() {
  W = wallView(data);
  E.drone = h('div', { style: 'position:absolute;transform:translate(-50%,-50%);width:30px;height:30px;color:#fff;filter:drop-shadow(0 0 6px rgba(0,0,0,.9));pointer-events:none', html: DRONE_SVG, role: 'img', 'aria-label': t('mo.dronePos') });
  W.el.append(E.drone);
  E.phases = ['ph.scan', 'ph.analysis', 'ph.reflight', 'ph.report'].map((k, i) => h('li', { style: 'display:flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:8px;font-size:13px' }, h('span', { class: 'mono small' }, String(i + 1)), t(k)));
  E.clock = h('span', { class: 'mono', style: 'font-size:20px;min-width:92px' });
  E.play = h('button', { type: 'button', class: 'btn blue round', onclick: toggle });
  E.speed = h('button', { type: 'button', class: 'btn mono', style: 'min-width:56px', onclick: () => { S.speed = S.speed === 1 ? 4 : S.speed === 4 ? 12 : 1; update(); } });
  E.chips = h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' });
  E.batt = h('span', { class: 'mono', style: 'font-size:26px;font-weight:600' }); E.battName = h('span', { class: 'muted' });
  E.battBar = h('i'); E.battNote = h('span', { class: 'small faint' });
  E.k = { alt: kpi('mo.alt'), stand: kpi('mo.stand'), speed: kpi('mo.speed'), x: kpi('mo.x') };
  E.rfRaw = h('span', { class: 'mono' }); E.rfFilt = h('span', { class: 'mono' }); E.rfState = h('p', { class: 'note' });
  E.rfChart = h('svg', { viewBox: '0 0 300 90', style: 'width:100%;height:90px', role: 'img', 'aria-label': t('mo.rfChart') });
  E.crop = h('div', { style: 'width:120px;height:120px;background-repeat:no-repeat;background-color:#2A2E33', role: 'img', 'aria-label': t('mo.cropAlt') });
  E.tileName = h('span', { class: 'mono small' }); E.pBar = h('i'); E.verdict = h('span', { class: 'mono small' });
  E.stages = h('div', { class: 'pipe' });
  E.chart = h('svg', { viewBox: '-28 -8 640 150', style: 'width:100%;height:auto', role: 'img', 'aria-label': t('mo.chart') });
  E.log = h('div', { class: 'log' }); E.nEv = h('span', { class: 'mono small faint' });
  E.banner = h('p', { class: 'note bad', hidden: true }, t('mo.rtlBanner'));

  app.replaceChildren(
    h('div', { class: 'head' },
      h('div', { style: 'display:flex;align-items:center;gap:14px;flex-wrap:wrap' },
        h('div', { class: 'stack', style: 'gap:2px' }, h('h1', { style: 'font-size:22px' }, t('mo.title')), h('span', { class: 'small faint' }, t('mo.crumb'))),
        h('span', { class: 'badge-sim' }, t('mo.sim'))),
      h('ol', { 'aria-label': t('mo.phase'), style: 'list-style:none;margin:0;padding:0;display:flex;gap:6px;flex-wrap:wrap' }, E.phases),
      h('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap' }, E.clock, E.play, E.speed,
        h('button', { type: 'button', class: 'btn', onclick: () => { stop(); M.reset(); update(); } }, t('mo.reset')),
        h('button', { type: 'button', class: 'btn danger', onclick: () => { M.returnToLaunch(); update(); } }, t('mo.rtl')))),
    E.chips, E.banner,
    h('div', { class: 'row', style: 'align-items:stretch' },
      h('section', { class: 'grow3 stack', 'aria-label': t('mo.wall') },
        h('div', { class: 'head' }, h('strong', null, t('mo.wall')), h('span', { class: 'small faint' }, t('mo.wallHint'))), W.el),
      h('aside', { class: 'grow2 stack', 'aria-label': t('mo.tele') },
        h('div', { class: 'panel stack', style: 'gap:8px' },
          h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' }, h('span', null, t('mo.battery'), ' · ', E.battName), E.batt),
          h('div', { class: 'bar', style: 'height:12px' }, E.battBar, h('span', { style: `position:absolute;left:${SIM.RESERVE * 100}%;top:0;bottom:0;width:2px;background:#E6E9EC;opacity:.6` })),
          E.battNote),
        h('div', { style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px' }, Object.values(E.k).map(k => k.el)),
        h('div', { class: 'panel stack', style: 'gap:8px' },
          h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:8px' }, h('strong', null, t('mo.rf')), h('span', { class: 'tag faint' }, 'MaxBotix MB1242')),
          h('div', { style: 'display:flex;justify-content:space-between;font-size:13px' }, h('span', { class: 'muted' }, t('mo.rfRaw')), E.rfRaw),
          h('div', { style: 'display:flex;justify-content:space-between;font-size:13px' }, h('span', { class: 'muted' }, t('mo.rfFilt')), E.rfFilt),
          E.rfChart, E.rfState),
        h('div', { class: 'panel', style: 'display:flex;gap:14px;align-items:center' },
          h('div', { style: 'position:relative;width:120px;height:120px;flex:none;border-radius:8px;overflow:hidden;border:1px solid var(--line-2)' }, E.crop,
            h('div', { style: 'position:absolute;left:40px;top:40px;width:40px;height:40px;border:2px solid #fff' })),
          h('div', { class: 'stack', style: 'flex:1;min-width:0;gap:6px' }, h('span', { class: 'small muted' }, t('mo.tile')), E.tileName,
            h('div', { class: 'bar', style: 'height:10px;overflow:visible' }, E.pBar, h('span', { style: `position:absolute;left:${THR * 100}%;top:-3px;bottom:-3px;width:2px;background:#E6E9EC` })), E.verdict)))),
    h('section', { class: 'stack', 'aria-label': t('mo.pipe') },
      h('div', { class: 'head' }, h('strong', null, t('mo.pipe')), h('span', { class: 'small faint' }, t('mo.pipeHint'))), E.stages),
    h('div', { class: 'row', style: 'align-items:stretch' },
      h('section', { class: 'panel stack grow1', style: 'flex:1 1 520px;gap:6px', 'aria-label': t('mo.chart') },
        h('div', { class: 'small muted', style: 'display:flex;gap:16px;flex-wrap:wrap' },
          h('span', null, h('span', { style: 'display:inline-block;width:16px;height:3px;background:var(--ok);margin-right:6px;vertical-align:middle' }), t('mo.lBatt')),
          h('span', null, h('span', { style: 'display:inline-block;width:16px;height:3px;background:var(--drone);margin-right:6px;vertical-align:middle' }), t('mo.lAlt')),
          h('span', null, h('span', { style: 'display:inline-block;width:16px;border-top:2px dashed var(--bad);margin-right:6px;vertical-align:middle' }), t('mo.lReserve'))),
        E.chart),
      h('section', { class: 'panel stack grow1', style: 'flex:1 1 420px;gap:4px', 'aria-label': t('mo.log') },
        h('div', { style: 'display:flex;justify-content:space-between' }, h('strong', null, t('mo.log')), E.nEv), E.log)),
  );
}

function stageList(T) {
  const ph = PH[T.phase], res = M.result;
  const st = i => {
    if (i <= 2) return ph === 0 ? 'run' : 'done';
    if (i === 3) return ph === 0 ? 'run' : 'done';
    if (i === 4) return ph === 0 ? 'wait' : T.phase === 'home' ? 'wait' : res ? 'done' : 'run';
    return ph < 2 ? 'wait' : ph === 2 ? 'run' : 'done';
  };
  const scanned = M.scanned.filter(Boolean).length;
  const live = [
    t('st.camLive', { n: M.stats.photos, h: M.stats.holds }),
    t('st.tileLive', { n: scanned }),
    t('st.cnnLive', { n: scanned, k: M.stats.cracks }),
    t('st.zonesLive', { n: res ? res.zones.length : liveZones() }),
    res ? t('st.routeLive', { d: fmt(res.ga.distance), k: res.ga.trips.length }) : t('st.routeWait'),
    T.phase === 'reflight' ? t('st.flyLive', { n: res.trip + 1, k: res.ga.trips.length, v: res.visited }) : T.phase === 'done' ? t('st.flyDone', { n: res.zones.length }) : t('st.flyWait'),
  ];
  const tags = ['ДРОН', 'НМ', 'НМ', 'АСД', 'ЕМП', 'ДРОН'], col = { 'ДРОН': 'var(--muted)', 'НМ': 'var(--crack)', 'АСД': 'var(--crack)', 'ЕМП': 'var(--drone)' };
  return [0, 1, 2, 3, 4, 5].map(i => {
    const s = st(i);
    return h('div', { class: 'cell' },
      h('div', { class: 'box ' + s },
        h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:6px' }, h('span', { class: 'mono small', style: `color:${col[tags[i]]}` }, t('tag.' + i)), h('span', { class: 'state ' + s }, t('state.' + s))),
        h('strong', { style: 'font-size:15px' }, t('st.t' + i)),
        h('span', { style: 'font-size:13px;color:var(--text-2);line-height:1.4' }, t('st.k' + i)),
        h('span', { class: 'mono', style: 'font-size:14px;color:#fff' }, live[i]),
        h('span', { class: 'mono', style: 'font-size:11px;color:var(--faint);line-height:1.4;margin-top:auto' }, t('st.x' + i))),
      i < 5 ? h('div', { class: 'arrow', 'aria-hidden': 'true', html: `<svg width="22" height="12" viewBox="0 0 22 12" fill="none" stroke="#5C6773" stroke-width="2"><path d="M1 6h18M14 1l5 5-5 5"/></svg><span>${t('st.o' + i)}</span>` }) : null);
  });
}

function liveZones() {
  const seen = new Uint8Array(R * C); let n = 0;
  for (let i = 0; i < R * C; i++) {
    const r = Math.floor(i / C), c = i % C;
    if (seen[i] || !M.scanned[i] || data.probs[r][c] < THR) continue;
    n++; const st = [i]; seen[i] = 1;
    while (st.length) {
      const k = st.pop(), a = Math.floor(k / C), b = k % C;
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) {
        const rr = a + x, cc = b + y, j = rr * C + cc;
        if (rr >= 0 && cc >= 0 && rr < R && cc < C && !seen[j] && M.scanned[j] && data.probs[rr][cc] >= THR) { seen[j] = 1; st.push(j); }
      }
    }
  }
  return n;
}

function update() {
  const T = M.telemetry(), ph = PH[T.phase];
  E.phases.forEach((li, i) => { li.style.background = i === ph ? '#2A333D' : 'transparent'; li.style.color = i === ph ? '#fff' : i < ph ? 'var(--ok)' : 'var(--faint)'; li.style.fontWeight = i === ph ? '600' : '400'; });
  E.clock.textContent = fmtClock(T.time);
  E.play.innerHTML = S.playing ? PAUSE : PLAY; E.play.setAttribute('aria-label', t(S.playing ? 'rt.pause' : 'mo.play'));
  E.speed.textContent = '×' + S.speed;
  E.banner.hidden = !(M.rtl);

  const alerts = [];
  if (T.batt < SIM.RESERVE * 100 && T.phase !== 'analysis') alerts.push(t('al.reserve', { b: fmt(T.batt, 0) }));
  if (T.correction) alerts.push(t('al.standoff', { d: fmt(T.rangeFiltered, 2) }));
  const chip = (txt, col, alert) => h('span', { class: 'chip' + (alert ? ' alert' : '') }, h('span', { class: 'dot', style: `background:${col}` }), txt);
  E.chips.replaceChildren(
    chip(t('ch.link', { n: T.link }), T.link > 85 ? 'var(--ok)' : 'var(--crack)'), chip(t('ch.gps', { n: T.gps }), 'var(--ok)'),
    chip(t('ch.mode', { m: t('mode.' + T.phase) }), 'var(--drone)'), chip(t('ch.model', { t: THR }), 'var(--muted)'),
    chip(t('ch.rf', { s: T.phase === 'scan' ? (T.canShoot ? t('ch.rfOk') : t('ch.rfHold')) : t('ch.rfIdle') }), T.phase === 'scan' ? (T.canShoot ? 'var(--ok)' : 'var(--crack)') : 'var(--muted)'),
    ...(alerts.length ? alerts.map(a => chip(a, 'var(--bad)', true)) : [chip(t('ch.noAlerts'), 'var(--ok)')]));

  // стена
  const cur = T.current;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const p = data.probs[r][c], seen = M.scanned[r * C + c], cell = W.cells[r * C + c];
    let bg = 'rgba(8,11,14,.8)';
    if (seen) bg = ph >= 1 ? (p >= THR ? 'rgba(245,165,36,.55)' : 'rgba(8,11,14,.35)') : (p > 0.05 ? `rgba(245,165,36,${(p * 0.85).toFixed(2)})` : 'transparent');
    cell.style.background = bg;
    cell.style.boxShadow = cur && cur[0] === r && cur[1] === c ? 'inset 0 0 0 2px #fff' : '';
  }
  W.svg.replaceChildren();
  W.labels.replaceChildren();
  if (M.result && ph >= 1) {
    const p = M.result.p, cols = ['#4CC3E6', '#A99BFF', '#7BD88F', '#E6E9EC'];
    M.result.ga.trips.forEach((tr, i) => W.svg.append(h('path', { d: 'M' + [0, ...tr, 0].map(k => m2tile(p.points[k], R, TM).join(' ')).join(' L'), fill: 'none', stroke: cols[i % 4], 'stroke-width': '0.14', 'stroke-dasharray': i % 2 ? '0.5 0.3' : null, 'stroke-linejoin': 'round' })));
    const visited = new Set(M.result.ga.trips.flat().slice(0, M.result.visited));
    M.result.zones.forEach((z, i) => { const s = h('span', { class: 'zl' + (visited.has(i + 1) ? ' done' : '') }, (visited.has(i + 1) ? '✓ ' : '#') + (i + 1)); Object.assign(s.style, pct(z.center, R, C)); W.labels.append(s); });
  }
  const dp = m2tile(T.pos, R, TM);
  Object.assign(E.drone.style, { left: (dp[0] / C) * 100 + '%', top: (dp[1] / R) * 100 + '%', opacity: T.phase === 'analysis' || T.phase === 'done' || T.phase === 'aborted' ? '0' : '1' });

  // телеметрия
  const bc = T.batt < 20 ? 'var(--bad)' : T.batt < 40 ? 'var(--crack)' : 'var(--ok)';
  E.batt.textContent = fmt(T.batt, 0) + ' %'; E.batt.style.color = bc; E.battName.textContent = t('mo.pack', { n: T.battName });
  E.battBar.style.cssText = `width:${T.batt}%;background:${bc}`;
  E.battNote.textContent = T.phase === 'reflight' ? t('mo.battLeft', { m: fmt((T.batt / 100) * SIM.BATTERY - SIM.RESERVE * SIM.BATTERY, 0) }) : t('mo.battReserve');
  E.k.alt.v.textContent = fmt(T.alt) + ' m'; E.k.alt.hint.textContent = t('mo.altH');
  E.k.stand.v.textContent = T.rangeFiltered == null ? '—' : fmt(T.rangeFiltered, 2) + ' m'; E.k.stand.hint.textContent = t('mo.standH', { t: SIM.TARGET.toFixed(2) });
  E.k.speed.v.textContent = fmt(T.speed) + ' m/s'; E.k.speed.hint.textContent = t(T.phase === 'scan' ? 'mo.speedScan' : 'mo.speedFly');
  E.k.x.v.textContent = fmt(T.pos[0]) + ' m'; E.k.x.hint.textContent = t('mo.xH');

  // далекомер
  E.rfRaw.textContent = T.phase !== 'scan' ? '—' : T.rangeRaw == null ? t('mo.rfNone') : fmt(T.rangeRaw, 2) + ' m';
  E.rfFilt.textContent = T.rangeFiltered == null ? '—' : fmt(T.rangeFiltered, 2) + ' m';
  if (T.phase !== 'scan') { E.rfState.className = 'note'; E.rfState.style.color = 'var(--muted)'; E.rfState.textContent = t('mo.rfIdle'); }
  else if (T.canShoot) { E.rfState.className = 'note ok'; E.rfState.style.color = ''; E.rfState.textContent = t('mo.rfOk'); }
  else { E.rfState.className = 'note warn'; E.rfState.style.color = ''; E.rfState.textContent = T.correction ? t('mo.rfMove', { c: fmt(Math.abs(T.correction), 2), dir: t(T.correction > 0 ? 'dir.closer' : 'dir.farther') }) : t('mo.rfWait'); }
  const yv = v => 85 - ((Math.min(4, Math.max(0, v)) - 0) / 4) * 80, n = M.raw.length;
  const X = i => (i / 79) * 300;
  const band = h('rect', { x: 0, y: yv(SIM.TARGET + SIM.TOL), width: 300, height: yv(SIM.TARGET - SIM.TOL) - yv(SIM.TARGET + SIM.TOL), fill: 'rgba(123,216,143,.12)' });
  const dots = M.raw.map((v, i) => v == null ? h('line', { x1: X(i + 80 - n), y1: 80, x2: X(i + 80 - n), y2: 88, stroke: '#E5484D', 'stroke-width': '1.5' }) : h('circle', { cx: X(i + 80 - n), cy: yv(v), r: '1.8', fill: v < 1 ? '#E5484D' : '#AEB6C0' }));
  const line = M.filtered.map((v, i) => (v == null ? null : `${X(i + 80 - n)},${yv(v)}`)).filter(Boolean).join(' ');
  E.rfChart.replaceChildren(band, ...dots, line ? h('polyline', { points: line, fill: 'none', stroke: '#4CC3E6', 'stroke-width': '2' }) : '',
    h('text', { x: 296, y: yv(SIM.TARGET) - 4, 'text-anchor': 'end', 'font-size': '9', fill: '#7BD88F', 'font-family': 'JetBrains Mono, monospace' }, '3.00 m ± 0.15'));

  // плочка под дрона
  const rc = cur || [Math.min(R - 1, Math.max(0, Math.floor(R - T.pos[1] / TM))), Math.min(C - 1, Math.max(0, Math.floor(T.pos[0] / TM)))];
  const p = data.probs[rc[0]][rc[1]];
  E.crop.style.backgroundImage = `url(${data.image})`; E.crop.style.backgroundSize = `${C * 40}px ${R * 40}px`; E.crop.style.backgroundPosition = `${-(rc[1] - 1) * 40}px ${-(rc[0] - 1) * 40}px`;
  E.tileName.textContent = t('mo.tileName', { r: rc[0], c: rc[1], p: p.toFixed(2) });
  E.pBar.style.cssText = `width:${p * 100}%;background:${p >= THR ? 'var(--crack)' : '#5C6773'}`;
  E.verdict.textContent = t(p >= THR ? 'mo.above' : 'mo.below'); E.verdict.style.color = p >= THR ? 'var(--crack)' : 'var(--muted)';

  E.stages.replaceChildren(...stageList(T));

  // графика
  const hist = M.history, tmax = Math.max(600, T.time * 1.05), sx = v => (v / tmax) * 600;
  E.chart.replaceChildren(
    h('line', { x1: 0, y1: 120, x2: 600, y2: 120, stroke: '#2E3740' }),
    h('line', { x1: 0, y1: 120 - SIM.RESERVE * 120, x2: 600, y2: 120 - SIM.RESERVE * 120, stroke: '#E5484D', 'stroke-dasharray': '5 4', opacity: '.8' }),
    h('g', { 'font-family': 'JetBrains Mono, monospace', 'font-size': '10', fill: '#8D97A3' }, h('text', { x: -26, y: 4 }, '100'), h('text', { x: -20, y: 64 }, '50'), h('text', { x: -14, y: 123 }, '0'), h('text', { x: 560, y: 138 }, fmtClock(tmax))),
    h('polyline', { points: hist.map(s => `${sx(s.time)},${120 - Math.min(10, s.alt) * 12}`).join(' '), fill: 'none', stroke: '#4CC3E6', 'stroke-width': '1.6' }),
    h('polyline', { points: hist.map(s => `${sx(s.time)},${120 - s.batt * 1.2}`).join(' '), fill: 'none', stroke: '#7BD88F', 'stroke-width': '2.2' }),
    h('line', { x1: sx(T.time), y1: 0, x2: sx(T.time), y2: 120, stroke: '#E6E9EC' }));

  // журнал
  E.nEv.textContent = t('mo.nEv', { n: M.events.length });
  E.log.replaceChildren(...M.events.slice(-8).reverse().map(e => {
    const vars = { ...e.vars }; if (vars.dir) vars.dir = t('dir.' + vars.dir);
    return h('div', null, h('time', null, fmtClock(e.time)), h('span', { class: 'dot', style: `background:${DOT[e.kind]}` }), h('span', { style: 'color:#D5DBE1' }, t(e.key, vars)));
  }));
}

function toggle() {
  if (S.playing) { stop(); update(); return; }
  if (M.phase === 'done' || M.phase === 'aborted') M.reset();
  S.playing = true;
  timer = setInterval(() => {
    for (let i = 0; i < S.speed; i++) M.step();
    if (M.phase === 'done' || M.phase === 'aborted') stop();
    update();
  }, 50);
  update();
}
function stop() { clearInterval(timer); S.playing = false; }

// начално състояние: малко след началото, за да има какво да се види
for (let i = 0; i < 260; i++) M.step();
build(); update();
onLang(() => { build(); update(); });
