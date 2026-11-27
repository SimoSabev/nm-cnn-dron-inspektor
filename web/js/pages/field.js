// Проверка на място с ръчен ултразвуков уред (UPV): дълбочина на пукнатината и качество на бетона.
import { t, onLang } from '../i18n.js';
import { h, topbar, footer, loadDemo, fmt, storageGet, storageSet } from '../ui.js';
import { findZones, sortZonesByArea, probsToMap } from '../core.js';
import { fieldCheck } from '../ultrasound.js';

topbar('field.html');
footer();
const app = document.getElementById('app');
const data = await loadDemo();
const zones = sortZonesByArea(findZones(probsToMap(data.probs, data.threshold), 8).zones);
const KEY = 'field-checks-v1';
const S = { zone: 1, x: 100, tc: 53.9, ts: 50, cover: 30, saved: storageGet(KEY, []) };
let E = {};
const SEV_COL = { surface: 'var(--ok)', cover: 'var(--crack)', rebar: 'var(--bad)' };

function num(id, key, step, min) {
  return h('input', { id, type: 'number', step, min, value: String(S[key]), class: 'mono', oninput: e => { S[key] = parseFloat(e.target.value); update(); } });
}

function build() {
  E.zone = h('select', { id: 'fz', onchange: e => { S.zone = +e.target.value; update(); } },
    zones.map((z, i) => h('option', { value: String(i + 1), selected: i + 1 === S.zone ? true : null }, t('fd.zoneOpt', { n: i + 1, a: z.area }))));
  E.x = num('fx', 'x', '1', '1'); E.tc = num('ftc', 'tc', '0.1', '0'); E.ts = num('fts', 'ts', '0.1', '0'); E.cover = num('fcv', 'cover', '1', '1');
  E.depth = h('span', { class: 'mono', style: 'font-size:40px;font-weight:600;letter-spacing:-1px' });
  E.vel = h('span', { class: 'mono' }); E.q = h('span', { class: 'tag' }); E.sev = h('span', { class: 'tag' });
  E.expl = h('p', { class: 'note' }); E.err = h('p', { class: 'note bad', hidden: true });
  E.diagram = h('svg', { viewBox: '0 0 520 260', style: 'width:100%;display:block', role: 'img', 'aria-label': t('fd.diagAlt') });
  E.table = h('tbody'); E.summary = h('div', { class: 'stack', style: 'gap:6px' });
  app.replaceChildren(
    h('div', { class: 'stack', style: 'gap:8px;max-width:900px' },
      h('span', { class: 'small faint' }, t('fd.crumb')), h('h1', null, t('fd.title')), h('p', { class: 'muted' }, t('fd.lead'))),
    h('div', { class: 'row' },
      h('section', { class: 'grow1 panel stack', 'aria-label': t('fd.input') },
        h('div', { class: 'field' }, h('label', { for: 'fz' }, t('fd.zone')), E.zone),
        h('div', { style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px' },
          h('div', { class: 'field' }, h('label', { for: 'fx' }, t('fd.x')), E.x),
          h('div', { class: 'field' }, h('label', { for: 'fcv' }, t('fd.cover')), E.cover),
          h('div', { class: 'field' }, h('label', { for: 'fts' }, t('fd.ts')), E.ts),
          h('div', { class: 'field' }, h('label', { for: 'ftc' }, t('fd.tc')), E.tc)),
        h('p', { class: 'small faint' }, t('fd.how')),
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
          h('button', { type: 'button', class: 'btn primary', onclick: save }, t('fd.save')),
          h('button', { type: 'button', class: 'btn', onclick: example }, t('fd.example')))),
      h('section', { class: 'grow2 stack', 'aria-label': t('fd.result') },
        h('div', { class: 'panel stack' },
          h('div', { class: 'head' }, h('div', { class: 'stack', style: 'gap:2px' }, h('span', { class: 'small faint' }, t('fd.depth')), E.depth),
            h('div', { class: 'stack', style: 'gap:6px;align-items:flex-end' }, E.vel, h('div', { style: 'display:flex;gap:6px' }, E.q, E.sev))),
          E.err, E.diagram, E.expl))),
    h('section', { class: 'row', 'aria-label': t('fd.saved') },
      h('div', { class: 'grow3 panel stack' },
        h('div', { class: 'head' }, h('h2', null, t('fd.saved')), h('button', { type: 'button', class: 'btn', onclick: exportCsv }, t('fd.csv'))),
        h('div', { class: 'scrollx' }, h('table', { class: 'small' },
          h('thead', null, h('tr', null, ...['fd.thZone', 'fd.thDepth', 'fd.thV', 'fd.thQ', 'fd.thSev', 'fd.thTime', ''].map(k => h('th', null, k ? t(k) : '')))), E.table))),
      h('div', { class: 'grow1 panel stack' }, h('h2', null, t('fd.byZone')), E.summary)),
    h('p', { class: 'small faint' }, t('fd.std')),
  );
}

function current() {
  try { return { ok: true, r: fieldCheck({ zone: S.zone, xMm: S.x, tcUs: S.tc, tsUs: S.ts, coverMm: S.cover }) }; }
  catch (e) { return { ok: false, msg: e.message === 'Tc < Ts' ? t('fd.errTc') : t('fd.errInput') }; }
}

function diagram(depth) {
  const sx = 520, surf = 70, x = 150, cx = 260, scale = Math.min(1.6, 140 / Math.max(depth, 1)), hpx = Math.max(4, depth * scale);
  const tx = cx - x, rx = cx + x;
  E.diagram.replaceChildren(
    h('rect', { x: 0, y: surf, width: sx, height: 190, fill: '#2A2E33' }),
    h('line', { x1: 0, y1: surf, x2: sx, y2: surf, stroke: '#5C6773', 'stroke-width': '2' }),
    h('text', { x: 10, y: surf + 24, fill: '#AEB6C0', 'font-size': '12' }, t('fd.dConcrete')),
    h('polygon', { points: `${cx - 4},${surf} ${cx + 4},${surf} ${cx},${surf + hpx}`, fill: '#0E1216', stroke: '#F5A524', 'stroke-width': '1.5' }),
    h('polyline', { points: `${tx},${surf} ${cx},${surf + hpx} ${rx},${surf}`, fill: 'none', stroke: '#4CC3E6', 'stroke-width': '2', 'stroke-dasharray': '6 4' }),
    h('line', { x1: tx, y1: surf - 30, x2: rx, y2: surf - 30, stroke: '#7BD88F', 'stroke-width': '2', 'stroke-dasharray': '2 4' }),
    h('text', { x: cx, y: surf - 38, fill: '#7BD88F', 'font-size': '12', 'text-anchor': 'middle' }, t('fd.dTs')),
    h('text', { x: cx + 18, y: surf + hpx / 2 + 4, fill: '#F5A524', 'font-size': '13', 'font-family': 'JetBrains Mono, monospace' }, `h = ${fmt(depth)} mm`),
    h('text', { x: tx - 22, y: surf - 6, fill: '#AEB6C0', 'font-size': '12', 'text-anchor': 'end', 'font-family': 'JetBrains Mono, monospace' }, `x = ${S.x} mm`),
    h('text', { x: cx, y: surf + hpx + 22, fill: '#4CC3E6', 'font-size': '12', 'text-anchor': 'middle' }, t('fd.dTc')),
    ...[[tx, t('fd.dTx')], [rx, t('fd.dRx')]].flatMap(([px, lbl]) => [
      h('rect', { x: px - 14, y: surf - 22, width: 28, height: 22, rx: 4, fill: '#E6E9EC' }),
      h('text', { x: px, y: surf - 48, fill: '#E6E9EC', 'font-size': '12', 'text-anchor': 'middle' }, lbl)]),
    h('line', { x1: 0, y1: surf + S.cover * scale, x2: sx, y2: surf + S.cover * scale, stroke: '#E5484D', 'stroke-dasharray': '4 4', opacity: '.8' }),
    h('text', { x: 10, y: surf + S.cover * scale + 18, fill: '#FF8A8E', 'font-size': '12' }, t('fd.dRebar', { c: S.cover })));
}

function update() {
  const c = current();
  E.err.hidden = c.ok;
  [E.q, E.sev, E.expl].forEach(el => { el.hidden = !c.ok; });
  if (!c.ok) { E.err.textContent = c.msg; E.depth.textContent = '—'; E.vel.textContent = ''; E.q.textContent = ''; E.sev.textContent = ''; E.expl.textContent = ''; diagram(0); }
  else {
    const r = c.r;
    E.depth.textContent = `${fmt(r.depthMm)} mm`;
    E.vel.textContent = t('fd.vel', { v: fmt(r.velocityKms, 2) });
    E.q.textContent = t('q.' + r.quality); E.q.style.color = r.quality === 'doubtful' ? 'var(--bad-text)' : r.quality === 'medium' ? 'var(--crack)' : 'var(--ok)';
    E.sev.textContent = t('sev.' + r.severity); E.sev.style.color = SEV_COL[r.severity];
    E.expl.className = 'note ' + (r.severity === 'rebar' ? 'bad' : r.severity === 'cover' ? 'warn' : 'ok');
    E.expl.textContent = t('sevx.' + r.severity, { d: fmt(r.depthMm), c: S.cover });
    diagram(r.depthMm);
  }
  E.table.replaceChildren(...S.saved.map((m, i) => h('tr', null,
    h('td', { class: 'mono' }, '#' + m.zone), h('td', { class: 'mono' }, `${fmt(m.depthMm)} mm`), h('td', { class: 'mono' }, `${fmt(m.velocityKms, 2)} km/s`),
    h('td', null, t('q.' + m.quality)), h('td', { style: `color:${SEV_COL[m.severity]}` }, t('sev.' + m.severity)), h('td', { class: 'mono faint' }, m.time),
    h('td', null, h('button', { type: 'button', class: 'btn', style: 'height:32px;padding:0 10px', 'aria-label': t('fd.del'), onclick: () => { S.saved.splice(i, 1); storageSet(KEY, S.saved); update(); } }, '×')))));
  if (!S.saved.length) E.table.append(h('tr', null, h('td', { colspan: '7', class: 'faint' }, t('fd.none'))));
  E.summary.replaceChildren(...zones.map((z, i) => {
    const ms = S.saved.filter(m => m.zone === i + 1), worst = ms.reduce((a, m) => (!a || m.depthMm > a.depthMm ? m : a), null);
    return h('div', { style: 'display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)' },
      h('span', { class: 'mono crack' }, '#' + (i + 1)),
      worst ? h('span', { style: `color:${SEV_COL[worst.severity]}` }, `${t('sev.' + worst.severity)} · ${fmt(worst.depthMm)} mm`) : h('span', { class: 'faint' }, t('fd.notChecked')));
  }));
}

function save() {
  const c = current();
  if (!c.ok) return;
  S.saved.push({ ...c.r, x: S.x, tc: S.tc, ts: S.ts, cover: S.cover, time: new Date().toLocaleString() });
  if (!storageSet(KEY, S.saved)) E.err.hidden = false, E.err.textContent = t('fd.noStorage');
  update();
}

function example() {
  // пукнатина 40 mm при x = 100 mm и бетон 4.0 km/s: Ts = 2x/v, Tc = 2·sqrt(x² + h²)/v
  Object.assign(S, { x: 100, ts: 50, tc: Math.round((2 * Math.sqrt(100 * 100 + 40 * 40) / 4) * 10) / 10, cover: 30 });
  build(); update();
}

function exportCsv() {
  const rows = [['zone', 'x_mm', 'tc_us', 'ts_us', 'cover_mm', 'depth_mm', 'velocity_kms', 'quality', 'severity', 'time']]
    .concat(S.saved.map(m => [m.zone, m.x, m.tc, m.ts, m.cover, m.depthMm, m.velocityKms, m.quality, m.severity, `"${m.time}"`]));
  const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
  const a = h('a', { href: URL.createObjectURL(blob), download: 'ultrazvuk-proverka.csv' });
  document.body.append(a); a.click(); a.remove();
}

build(); update();
onLang(() => { build(); update(); });
