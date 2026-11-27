// Ядро на сайта: същите алгоритми като в src/ (АСД + ЕМП), пренесени на JavaScript,
// за да работят в браузъра без сървър. Съвпадението с Python се проверява от
// web/tests/parity.test.mjs срещу резултати, изчислени със src/ (tools/make_golden.py).
//
// Core of the website: the same algorithms as src/ (zones + routing), ported to
// JavaScript so they run in the browser with no server. Parity with the Python
// code is checked by web/tests/parity.test.mjs against tools/make_golden.py.

const MOVES_4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const MOVES_8 = MOVES_4.concat([[-1, -1], [-1, 1], [1, -1], [1, 1]]);

// ---------------------------------------------------------------- АСД: зони

/**
 * Свързани зони от единици – РЕКУРСИВНО обхождане, като src/grid_zones.find_zones:
 * от всяка непосетена единица „заливаме“ рекурсивно всички съседни единици.
 */
export function findZones(grid, connectivity = 8) {
  const moves = connectivity === 4 ? MOVES_4 : MOVES_8;
  const R = grid.length, C = R ? grid[0].length : 0;
  const labels = grid.map(row => row.map(() => 0));
  const zones = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (grid[r][c] === 1 && labels[r][c] === 0) {
      const cells = [];
      fill(grid, labels, r, c, zones.length + 1, cells, moves);
      zones.push(makeZone(zones.length + 1, cells));
    }
  }
  return { zones, labels };
}

/** Рекурсивно „заливане“ (като _fill в src/grid_zones.py). Дъно: извън решетката, 0 или вече посетена. */
function fill(grid, labels, r, c, id, cells, moves) {
  if (r < 0 || r >= grid.length || c < 0 || c >= grid[0].length) return;
  if (grid[r][c] !== 1 || labels[r][c] !== 0) return;
  labels[r][c] = id;            // маркираме – повече няма да влезем тук
  cells.push([r, c]);
  for (const [dr, dc] of moves) fill(grid, labels, r + dr, c + dc, id, cells, moves);
}

function makeZone(id, cells) {
  const rows = cells.map(c => c[0]), cols = cells.map(c => c[1]), n = cells.length;
  return {
    id, cells, area: n,
    bbox: [Math.min(...rows), Math.min(...cols), Math.max(...rows), Math.max(...cols)],
    // център на тежестта в координати на плочките; +0.5 = центърът на плочката
    center: [rows.reduce((a, b) => a + b, 0) / n + 0.5, cols.reduce((a, b) => a + b, 0) / n + 0.5],
  };
}

/** Рекурсивно сортиране чрез сливане, стабилно (като src/grid_zones.merge_sort). */
export function mergeSort(items, key = x => x, cmp = defaultCmp) {
  if (items.length <= 1) return items.slice();
  const mid = items.length >> 1;
  const left = mergeSort(items.slice(0, mid), key, cmp), right = mergeSort(items.slice(mid), key, cmp);
  const out = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (cmp(key(left[i]), key(right[j])) <= 0) out.push(left[i++]); else out.push(right[j++]);
  }
  return out.concat(left.slice(i), right.slice(j));
}

function defaultCmp(a, b) {
  if (Array.isArray(a)) {
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
    return 0;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Първо най-голямата зона; при равна площ – по-горната, после по-лявата. */
export function sortZonesByArea(zones) {
  return mergeSort(zones, z => [-z.area, z.bbox[0], z.bbox[1]]);
}

/** Вероятности от CNN → карта 0/1 по праг. */
export function probsToMap(probs, threshold) {
  return probs.map(row => row.map(p => (p >= threshold ? 1 : 0)));
}

// ---------------------------------------------------------------- ЕМП: задача

/**
 * Зони → задача за маршрута (като src/pipeline.zones_to_problem), плюс резерв.
 * reserve: дял от батерията, който НЕ се харчи (напр. 0.2 = 20 %). 0 = като в src/.
 */
export function zonesToProblem(zones, rows, { tileM = 0.5, base = [0, 0], battery = 60, inspectCostPerTile = 1, reserve = 0 } = {}) {
  const points = [base], service = [0];
  for (const z of zones) {
    const [r, c] = z.center;
    points.push([c * tileM, (rows - r) * tileM]);
    service.push(inspectCostPerTile * z.area);
  }
  return makeProblem(points, service, battery * (1 - reserve));
}

export function makeProblem(points, service, battery) {
  const m = points.length, dist = [];
  for (let i = 0; i < m; i++) {
    dist.push(new Array(m).fill(0));
  }
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
    dist[i][j] = dist[j][i] = Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]);
  }
  const unreachable = [];
  for (let i = 1; i < m; i++) if (dist[0][i] + service[i] + dist[i][0] > battery + 1e-9) unreachable.push(i);
  return { points, service, battery, dist, n: m - 1, unreachable };
}

export function tripEnergy(p, trip) {
  if (!trip.length) return 0;
  let e = p.dist[0][trip[0]] + p.dist[trip[trip.length - 1]][0];
  for (let k = 0; k + 1 < trip.length; k++) e += p.dist[trip[k]][trip[k + 1]];
  return e + trip.reduce((s, i) => s + p.service[i], 0);
}

export function tripDistance(p, trip) {
  return tripEnergy(p, trip) - trip.reduce((s, i) => s + p.service[i], 0);
}

export function totalDistance(p, trips) {
  return trips.reduce((s, t) => s + tripDistance(p, t), 0);
}

export function isFeasible(p, trips) {
  const seen = trips.flat().slice().sort((a, b) => a - b);
  if (seen.length !== p.n || seen.some((v, k) => v !== k + 1)) return false;
  return trips.every(t => tripEnergy(p, t) <= p.battery + 1e-9);
}

/** Оптимално разделяне на зададен ред на рейсове (като src/route_planning.split_tour). */
export function splitTour(p, order) {
  const { dist: d, service: s, battery: B } = p, n = order.length;
  const V = [0].concat(new Array(n).fill(Infinity)), pred = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    if (V[i] === Infinity) continue;
    let energy = 0, travel = 0;
    for (let j = i; j < n; j++) {
      const cur = order[j];
      travel = j === i ? d[0][cur] : travel + d[order[j - 1]][cur];
      energy += s[cur];
      if (travel + energy + d[cur][0] > B + 1e-9) break;
      const cost = travel + d[cur][0];
      if (V[i] + cost < V[j + 1]) { V[j + 1] = V[i] + cost; pred[j + 1] = i; }
    }
  }
  const trips = [];
  let j = n;
  while (j > 0) { const i = pred[j]; trips.push(order.slice(i, j)); j = i; }
  trips.reverse();
  return { cost: V[n], trips };
}

// ---------------------------------------------------------------- евристики

/** Най-близък съсед с батерия (като src/route_planning.nearest_neighbor). O(n²). */
export function nearestNeighbor(p) {
  const t0 = now(), { dist: d, service: s, battery: B } = p;
  const unvisited = new Set(); for (let i = 1; i <= p.n; i++) unvisited.add(i);
  const trips = [];
  while (unvisited.size) {
    let cur = 0, left = B; const trip = [];
    for (;;) {
      let best = null, bestD = Infinity;
      for (const j of [...unvisited].sort((a, b) => a - b)) {
        const canReturn = d[cur][j] + s[j] + d[j][0] <= left + 1e-9;
        if (canReturn && (d[cur][j] < bestD || (d[cur][j] === bestD && j < best))) { best = j; bestD = d[cur][j]; }
      }
      if (best === null) break;
      left -= d[cur][best] + s[best];
      trip.push(best); unvisited.delete(best); cur = best;
    }
    if (!trip.length) throw new Error('Недостижима зона / unreachable zone');
    trips.push(trip);
  }
  return { method: 'nn', trips, distance: totalDistance(p, trips), ms: now() - t0 };
}

/** Детерминиран генератор на случайни числа (mulberry32), за да се повтарят резултатите. */
export function rng(seed = 0) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { random: next, int: k => Math.floor(next() * k) };
}

function orderCrossover(p1, p2, R) {
  const n = p1.length;
  let a = R.int(n), b = R.int(n - 1); if (b >= a) b++; if (a > b) [a, b] = [b, a];
  const child = new Array(n).fill(null), taken = new Set();
  for (let i = a; i <= b; i++) { child[i] = p1[i]; taken.add(p1[i]); }
  const fill = p2.filter(g => !taken.has(g));
  let k = 0;
  for (let i = 0; i < n; i++) if (child[i] === null) child[i] = fill[k++];
  return child;
}

function mutate(ind, R) {
  const n = ind.length;
  let a = R.int(n), b = R.int(n - 1); if (b >= a) b++; if (a > b) [a, b] = [b, a];
  if (R.random() < 0.7) { const seg = ind.slice(a, b + 1).reverse(); for (let i = a; i <= b; i++) ind[i] = seg[i - a]; }
  else [ind[a], ind[b]] = [ind[b], ind[a]];
}

/**
 * Генетичен алгоритъм (като src/route_planning.genetic_algorithm): пермутации,
 * декодер splitTour, турнир, OX, мутация обръщане/размяна, елитизъм.
 * onImprove(gen, cost, trips) се вика при всяко подобрение – за анимации.
 */
export function geneticAlgorithm(p, { popSize = 80, generations = 400, crossoverRate = 0.9, mutationRate = 0.3,
  tournamentK = 3, elite = 2, patience = 120, seed = 0, onImprove = null } = {}) {
  const t0 = now(), R = rng(seed), n = p.n, genes = Array.from({ length: n }, (_, i) => i + 1);
  if (n === 0) return { method: 'ga', trips: [], distance: 0, ms: 0, history: [0], generations: 0 };
  if (n <= 2) {
    const perms = n === 1 ? [[1]] : [[1, 2], [2, 1]];
    const best = perms.map(o => splitTour(p, o)).reduce((a, b) => (b.cost < a.cost ? b : a));
    return { method: 'ga', trips: best.trips, distance: best.cost, ms: now() - t0, history: [best.cost], generations: 0 };
  }
  const cache = new Map();
  const fit = ind => { const k = ind.join(','); if (!cache.has(k)) cache.set(k, splitTour(p, ind).cost); return cache.get(k); };
  let pop = [];
  while (pop.length < popSize) {
    const ind = genes.slice();
    for (let i = n - 1; i > 0; i--) { const j = R.int(i + 1); [ind[i], ind[j]] = [ind[j], ind[i]]; }
    pop.push(ind);
  }
  const tournament = () => {
    let best = null;
    for (let k = 0; k < tournamentK; k++) { const c = pop[R.int(pop.length)]; if (!best || fit(c) < fit(best)) best = c; }
    return best;
  };
  let best = pop.reduce((a, b) => (fit(b) < fit(a) ? b : a)), bestCost = fit(best), stale = 0, gen = 0;
  const history = [bestCost];
  if (onImprove) onImprove(0, bestCost, splitTour(p, best).trips);
  for (gen = 1; gen <= generations; gen++) {
    pop.sort((a, b) => fit(a) - fit(b));
    const next = pop.slice(0, elite).map(x => x.slice());
    while (next.length < popSize) {
      const p1 = tournament(), p2 = tournament();
      const child = R.random() < crossoverRate ? orderCrossover(p1, p2, R) : p1.slice();
      if (R.random() < mutationRate) mutate(child, R);
      next.push(child);
    }
    pop = next;
    const genBest = pop.reduce((a, b) => (fit(b) < fit(a) ? b : a));
    if (fit(genBest) < bestCost - 1e-9) {
      best = genBest.slice(); bestCost = fit(genBest); stale = 0;
      if (onImprove) onImprove(gen, bestCost, splitTour(p, best).trips);
    } else stale++;
    history.push(bestCost);
    if (stale >= patience) break;
  }
  const res = splitTour(p, best);
  return { method: 'ga', trips: res.trips, distance: res.cost, ms: now() - t0, history, generations: Math.min(gen, generations) };
}

/** Точно решение: всички n! пермутации + оптимално разделяне. Само за n <= maxN. */
export function exactSolution(p, maxN = 8) {
  if (p.n > maxN) throw new Error(`n = ${p.n} > ${maxN}`);
  const t0 = now();
  let bestCost = Infinity, bestTrips = [];
  const perm = Array.from({ length: p.n }, (_, i) => i + 1);
  const visit = k => {
    if (k === perm.length) {
      const r = splitTour(p, perm);
      if (r.cost < bestCost - 1e-12) { bestCost = r.cost; bestTrips = r.trips; }
      return;
    }
    for (let i = k; i < perm.length; i++) {
      [perm[k], perm[i]] = [perm[i], perm[k]];
      visit(k + 1);
      [perm[k], perm[i]] = [perm[i], perm[k]];
    }
  };
  visit(0);
  return { method: 'exact', trips: bestTrips, distance: p.n ? bestCost : 0, ms: now() - t0 };
}

/** Целият конвейер след CNN: карта 0/1 → зони → три метода. */
export function runPipeline(map, cfg = {}) {
  const rows = map.length;
  const { zones: raw, labels } = findZones(map, cfg.connectivity || 8);
  const zones = sortZonesByArea(raw);
  const out = { zones, labels, routes: {}, problem: null };
  if (!zones.length) return out;
  const p = zonesToProblem(zones, rows, cfg);
  out.problem = p;
  if (p.unreachable.length) return out;
  out.routes.nn = nearestNeighbor(p);
  out.routes.ga = geneticAlgorithm(p, { seed: cfg.gaSeed || 0 });
  if (p.n <= (cfg.exactMaxN || 8)) out.routes.exact = exactSolution(p, cfg.exactMaxN || 8);
  return out;
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
