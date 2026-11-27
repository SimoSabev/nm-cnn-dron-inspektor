// Проверява, че JavaScript ядрото на сайта смята същото като Python кода в src/.
// Пускане: node --test web/tests/   (еталоните: python -m tools.make_golden)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  findZones, sortZonesByArea, makeProblem, nearestNeighbor, splitTour, exactSolution,
  geneticAlgorithm, isFeasible, zonesToProblem, runPipeline,
} from '../js/core.js';
import { fieldCheck, medianFilter, isStable } from '../js/ultrasound.js';

const G = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'));
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('зоните и сортирането съвпадат с Python', () => {
  for (const c of G.cases) {
    const zones = sortZonesByArea(findZones(c.grid, 8).zones);
    assert.equal(zones.length, c.zones.length);
    zones.forEach((z, i) => {
      assert.equal(z.area, c.zones[i].area);
      assert.deepEqual(z.bbox, c.zones[i].bbox);
      close(z.center[0], c.zones[i].center[0]);
      close(z.center[1], c.zones[i].center[1]);
    });
  }
});

test('задачата за маршрута съвпада (точки и цена на огледа)', () => {
  for (const c of G.cases.filter(c => c.points)) {
    const zones = sortZonesByArea(findZones(c.grid, 8).zones);
    const p = zonesToProblem(zones, c.grid.length, { battery: c.battery });
    p.points.forEach((pt, i) => { close(pt[0], c.points[i][0]); close(pt[1], c.points[i][1]); });
    assert.deepEqual(p.service, c.service);
  }
});

test('най-близък съсед, split и точното решение съвпадат', () => {
  for (const c of G.cases.filter(c => c.points).concat([G.tight])) {
    const p = makeProblem(c.points, c.service, c.battery);
    const nn = nearestNeighbor(p);
    assert.deepEqual(nn.trips, c.nn.trips);
    close(nn.distance, c.nn.distance);
    for (const s of c.splits || []) {
      const r = splitTour(p, s.order);
      close(r.cost, s.cost);
      assert.deepEqual(r.trips, s.trips);
    }
    if (c.exact) close(exactSolution(p, 8).distance, c.exact.distance);
  }
});

test('ГА дава допустим маршрут, не по-лош от точното решение и не по-лош от НС', () => {
  for (const c of G.cases.filter(c => c.points).concat([G.tight])) {
    const p = makeProblem(c.points, c.service, c.battery);
    const ga = geneticAlgorithm(p, { seed: 1 });
    assert.ok(isFeasible(p, ga.trips));
    if (c.exact) assert.ok(ga.distance >= c.exact.distance - 1e-9);
    assert.ok(ga.distance <= c.nn.distance + 1e-9 || p.n <= 2, 'ГА е по-лош от НС');
  }
});

test('ГА е повторим при еднакво зърно (seed)', () => {
  const c = G.cases[2], p = makeProblem(c.points, c.service, c.battery);
  assert.equal(geneticAlgorithm(p, { seed: 7 }).distance, geneticAlgorithm(p, { seed: 7 }).distance);
});

test('конвейерът работи и без пукнатини', () => {
  const out = runPipeline([[0, 0], [0, 0]]);
  assert.equal(out.zones.length, 0);
});

test('ултразвук: дълбочина, скорост, клас и тежест съвпадат', () => {
  for (const u of G.ultrasound) {
    const r = fieldCheck({ zone: 1, xMm: u.x, tcUs: u.tc, tsUs: u.ts });
    close(r.depthMm, u.summary.depth_mm, 0.051);
    close(r.velocityKms, u.summary.velocity_kms, 0.0051);
    assert.equal(r.quality, u.summary.quality);
    assert.equal(r.severity, u.summary.severity);
  }
});

test('ултразвук: медианен филтър и стабилност на далекомера', () => {
  const rf = G.rangefinder;
  const m = medianFilter(rf.readings, 5);
  m.forEach((v, i) => (rf.median[i] === null ? assert.equal(v, null) : close(v, rf.median[i])));
  rf.readings.forEach((_, i) => assert.equal(isStable(rf.readings.slice(0, i + 1)), rf.stable[i]));
});
