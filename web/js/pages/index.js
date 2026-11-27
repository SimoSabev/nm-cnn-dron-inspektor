// Начална страница: историята на проекта в 5 стъпки, с истинските изчисления от ядрото.
import { t, onLang } from '../i18n.js';
import { h, topbar, footer, loadDemo, wallView, pct, m2tile, fmt } from '../ui.js';
import { runPipeline, probsToMap } from '../core.js';

topbar('index.html');
footer();
const app = document.getElementById('app');
const data = await loadDemo();
const R = data.rows, C = data.cols, TM = data.tile_m, P = data.probs, THR = data.threshold;
const out = runPipeline(probsToMap(P, THR), { tileM: TM, battery: 60, reserve: 0.2 });

function visual(kind) {
  const W = wallView(data);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const p = P[r][c], cell = W.cells[r * C + c];
    if (kind === 'grid') cell.style.boxShadow = 'inset 0 0 0 .5px rgba(255,255,255,.3)';
    if (kind === 'prob') cell.style.background = p > 0.05 ? `rgba(245,165,36,${(p * 0.85).toFixed(2)})` : 'transparent';
    if (kind === 'zones') cell.style.background = p >= THR ? 'rgba(245,165,36,.62)' : 'rgba(11,15,19,.3)';
    if (kind === 'route' || kind === 'hero') cell.style.background = p >= THR ? 'rgba(245,165,36,.45)' : 'transparent';
  }
  W.el.querySelector('img').style.filter = kind === 'route' || kind === 'hero' ? 'brightness(.6)' : kind === 'zones' ? 'brightness(.75)' : '';
  if (kind === 'zones') out.zones.forEach((z, i) => { const s = h('span', { class: 'zl' }, '#' + (i + 1)); Object.assign(s.style, pct(z.center, R, C)); W.labels.append(s); });
  if ((kind === 'route' || kind === 'hero') && out.routes.ga) {
    const cols = ['#4CC3E6', '#A99BFF', '#7BD88F'];
    out.routes.ga.trips.forEach((tr, i) => W.svg.append(h('path', { d: 'M' + [0, ...tr, 0].map(k => m2tile(out.problem.points[k], R, TM).join(' ')).join(' L'), fill: 'none', stroke: cols[i % 3], 'stroke-width': '0.16', 'stroke-linejoin': 'round', 'stroke-dasharray': i % 2 ? '0.5 0.3' : null })));
  }
  return W.el;
}

function render() {
  const ga = out.routes.ga, nn = out.routes.nn;
  const steps = [
    ['ix.s1', 'ix.b1', '#AEB6C0', 'grid', 'tiling.slice_into_tiles · 227 × 227 px · ' + t('ix.c1', { r: R, c: C })],
    ['ix.s2', 'ix.b2', '#F5A524', 'prob', t('ix.c2', { t: THR })],
    ['ix.s3', 'ix.b3', '#F5A524', 'zones', t('ix.c3', { n: out.zones.length })],
    ['ix.s4', 'ix.b4', '#4CC3E6', 'route', t('ix.c4', { ga: fmt(ga.distance), k: ga.trips.length, nn: fmt(nn.distance) })],
  ];
  app.replaceChildren(
    h('section', { class: 'row', style: 'align-items:center;gap:40px;padding:32px 0 48px' },
      h('div', { class: 'stack', style: 'flex:1 1 420px;gap:20px' },
        h('span', { class: 'mono small crack', style: 'letter-spacing:1px;text-transform:uppercase' }, t('ix.eyebrow')),
        h('h1', { style: 'font-size:clamp(34px,4.4vw,56px);line-height:1.06;letter-spacing:-1.2px' }, t('ix.h1')),
        h('p', { class: 'muted', style: 'font-size:17px;line-height:1.6' }, t('ix.lead')),
        h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' },
          h('a', { class: 'btn primary', href: 'monitor.html' }, t('ix.ctaMonitor')),
          h('a', { class: 'btn', href: 'sandbox.html' }, t('ix.ctaSandbox')))),
      h('div', { style: 'flex:1.3 1 520px;min-width:0' }, visual('hero'))),
    h('section', { class: 'stack', style: 'gap:64px', 'aria-label': t('ix.how') },
      ...steps.map(([title, body, col, kind, code], i) => h('article', { class: 'row', style: 'align-items:center;gap:40px' },
        h('div', { class: 'stack', style: 'flex:1 1 360px;gap:14px' },
          h('div', { style: 'display:flex;gap:10px;align-items:center' }, h('span', { class: 'mono faint' }, '0' + (i + 1)), h('span', { class: 'tag', style: `color:${col}` }, t('ix.tag' + i))),
          h('h2', { style: 'font-size:clamp(24px,2.6vw,34px);line-height:1.15' }, t(title)),
          h('p', { class: 'muted', style: 'font-size:16px;line-height:1.6' }, t(body)),
          h('span', { class: 'mono small faint' }, code)),
        h('div', { style: 'flex:1.3 1 520px;min-width:0' }, visual(kind)))),
      h('article', { class: 'row', style: 'align-items:center;gap:40px' },
        h('div', { class: 'stack', style: 'flex:1 1 360px;gap:14px' },
          h('div', { style: 'display:flex;gap:10px;align-items:center' }, h('span', { class: 'mono faint' }, '05'), h('span', { class: 'tag', style: 'color:#7BD88F' }, t('ix.tag4'))),
          h('h2', { style: 'font-size:clamp(24px,2.6vw,34px);line-height:1.15' }, t('ix.s5')),
          h('p', { class: 'muted', style: 'font-size:16px;line-height:1.6' }, t('ix.b5')),
          h('a', { class: 'btn', href: 'field.html', style: 'align-self:flex-start' }, t('ix.toField'))),
        h('div', { class: 'panel stack', style: 'flex:1.3 1 520px;min-width:0;gap:12px' },
          h('div', { class: 'row', style: 'gap:12px' },
            h('div', { class: 'kpi grow1' }, h('span', { class: 'l' }, t('ix.u1t')), h('span', { class: 'v' }, '3.00 m'), h('span', { class: 'h' }, t('ix.u1h'))),
            h('div', { class: 'kpi grow1' }, h('span', { class: 'l' }, t('ix.u2t')), h('span', { class: 'v' }, 'h = x·√(Tc²−Ts²)/Ts'), h('span', { class: 'h' }, 'BS 1881-203'))),
          h('p', { class: 'small muted' }, t('ix.uNote'))))),
    h('section', { class: 'kpis', style: 'padding:40px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-top:40px', 'aria-label': t('ix.numbers') },
      ...[['40 000', 'ix.n1'], ['100/100', 'ix.n2'], ['11–26 %', 'ix.n3'], [fmt((1 - ga.distance / nn.distance) * 100, 0) + ' %', 'ix.n4']].map(([v, k]) =>
        h('div', { class: 'stack', style: 'gap:6px' }, h('span', { class: 'mono', style: 'font-size:40px;font-weight:600;letter-spacing:-1px' }, v), h('span', { class: 'muted' }, t(k))))),
    h('section', { class: 'stack', style: 'gap:16px;padding-top:24px', 'aria-label': t('ix.team') },
      h('h2', null, t('ix.team')),
      h('div', { class: 'kpis', style: 'grid-template-columns:repeat(auto-fit,minmax(220px,1fr))' },
        ...['ix.r1', 'ix.r2', 'ix.r3', 'ix.r4'].map(k => h('div', { class: 'panel stack', style: 'gap:4px' }, h('strong', null, '[' + t('ix.name') + ']'), h('span', { class: 'muted' }, t(k))))),
      h('p', { class: 'small faint' }, t('ix.teamNote'))),
  );
}

render();
onLang(render);
