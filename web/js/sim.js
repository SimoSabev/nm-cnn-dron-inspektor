// Симулатор на мисията за екрана „Мониторинг“. Когато дронът е готов, на негово място
// идва източник на истинска телеметрия със същите полета (виж docs/web.md).
//
// Mission simulator for the Monitor page. A live telemetry source with the same
// fields replaces it once the drone exists (see docs/web.md).
import { findZones, sortZonesByArea, probsToMap, zonesToProblem, nearestNeighbor, geneticAlgorithm, exactSolution, rng } from './core.js';
import { RANGEFINDER, isStable, medianFilter, standoffCorrection } from './ultrasound.js';

const DT = 0.4;           // секунди симулирано време на една стъпка
const SCAN_SPEED = 0.5;   // m/s при сканиране (плочка 0.5 m за ~1 s, ако разстоянието е стабилно)
const FLY_SPEED = 2.5;    // m/s при прелитане
const BATTERY = 60;       // енергия на батерия (≈ m полет), като в src/pipeline.InspectionConfig
const RESERVE = 0.2;      // 20 % резерв – никога не се харчи

export class Mission {
  constructor(data, seed = 3) {
    this.d = data; this.R = data.rows; this.C = data.cols; this.TM = data.tile_m; this.thr = data.threshold;
    this.rand = rng(seed);
    this.reset();
  }

  reset() {
    const { R, C } = this;
    this.phase = 'scan'; this.time = 0; this.k = 0; this.batt = 100; this.battName = 1;
    this.scanned = new Array(R * C).fill(false);
    this.raw = []; this.filtered = []; this.hold = 0; this.offTarget = false;
    this.pos = this.tileCenter(this.order(0)); this.speed = 0; this.events = [];
    this.history = []; this.stats = { spikes: 0, holds: 0, cracks: 0, photos: 0 };
    this.result = null; this.fly = null; this.rtl = false; this.ticks = 0;
    this.log('info', 'ev.takeoff');
  }

  order(k) { // „косене“: отдолу нагоре, редовете се редуват ляво→дясно и дясно→ляво
    const row = Math.floor(k / this.C), i = k % this.C;
    return [this.R - 1 - row, row % 2 === 0 ? i : this.C - 1 - i];
  }

  tileCenter([r, c]) { return [(c + 0.5) * this.TM, (this.R - r - 0.5) * this.TM]; }

  log(kind, key, vars = {}) { this.events.push({ time: this.time, kind, key, vars }); }

  rangefinderReading() {
    const u = this.rand.random();
    const gust = Math.sin(this.time / 23) > 0.93 ? 0.35 * Math.sin(this.time / 23) : 0;   // порив на вятъра
    if (u < 0.035) { this.stats.spikes++; return 0.3 + this.rand.random() * 0.4; }        // ехо от витлото
    if (u < 0.05) return null;                                                            // изпуснато измерване
    return RANGEFINDER.targetM + gust + (this.rand.random() - 0.5) * 0.05;
  }

  step() {
    if (this.phase === 'done' || this.phase === 'aborted') return;
    this.ticks++; this.time += DT;
    if (this.phase === 'scan') this.stepScan();
    else if (this.phase === 'home') this.stepFly();
    else if (this.phase === 'analysis') this.stepAnalysis();
    else if (this.phase === 'reflight') this.stepFly();
    if (this.ticks % 5 === 0) this.history.push({ time: this.time, batt: this.batt, alt: this.pos[1], phase: this.phase });
  }

  stepScan() {
    const r = this.rangefinderReading();
    this.raw.push(r);
    if (this.raw.length > 80) this.raw.shift();
    this.filtered = medianFilter(this.raw, RANGEFINDER.window);
    const f = this.filtered[this.filtered.length - 1];
    const corr = standoffCorrection(f);
    if (corr && !this.offTarget) { this.offTarget = true; this.log('warn', 'ev.standoff', { d: f.toFixed(2), c: Math.abs(corr).toFixed(2), dir: corr > 0 ? 'closer' : 'farther' }); }
    if (!corr && this.offTarget) { this.offTarget = false; this.log('ok', 'ev.standoffOk'); }
    this.batt -= 0.07;
    if (isStable(this.raw)) {
      const [rr, cc] = this.order(this.k), p = this.d.probs[rr][cc];
      this.scanned[rr * this.C + cc] = true; this.stats.photos++;
      if (p >= this.thr) {
        this.stats.cracks++;
        let old = false;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          const x = rr + a, y = cc + b;
          if ((a || b) && x >= 0 && y >= 0 && x < this.R && y < this.C && this.scanned[x * this.C + y] && this.d.probs[x][y] >= this.thr) old = true;
        }
        this.log(old ? 'crack' : 'zone', old ? 'ev.crackMore' : 'ev.crackNew', { r: rr, c: cc, p: p.toFixed(2) });
      } else if (p >= this.thr - 0.06) this.log('warn', 'ev.suspicious', { r: rr, c: cc, p: p.toFixed(2), t: this.thr });
      this.k++; this.speed = SCAN_SPEED;
      if (this.k >= this.R * this.C) { this.log('ok', 'ev.scanDone', { n: this.k, k: this.stats.cracks, s: this.stats.spikes }); this.goHome(); return; }
      this.pos = this.tileCenter(this.order(this.k));
    } else { this.speed = 0; this.stats.holds++; }
    if (this.batt <= 25 && this.phase === 'scan') { this.log('warn', 'ev.lowScan'); this.goHome(); }
  }

  goHome(next = 'analysis') {
    this.phase = 'home'; this.speed = FLY_SPEED;
    this.fly = { legs: [{ from: this.pos.slice(), to: [0, 0], zone: 0 }], i: 0, done: 0, next };
  }

  stepAnalysis() {
    if (!this.result) {
      this.batt = 100; this.battName++; this.log('info', 'ev.swap');
      const map = probsToMap(this.d.probs, this.thr);
      const t0 = performance.now();
      const zones = sortZonesByArea(findZones(map, 8).zones);
      const tz = performance.now() - t0;
      const p = zonesToProblem(zones, this.R, { tileM: this.TM, battery: BATTERY, reserve: RESERVE });
      const nn = nearestNeighbor(p), ga = geneticAlgorithm(p, { seed: 0 }), ex = p.n <= 8 ? exactSolution(p, 8) : null;
      this.result = { zones, p, nn, ga, ex, tz, visited: 0, trip: 0 };
      this.log('ok', 'ev.zones', { n: zones.length, ms: tz.toFixed(1) });
      this.log('ok', 'ev.routes', { nn: nn.distance.toFixed(1), ga: ga.distance.toFixed(1), ex: ex ? ex.distance.toFixed(1) : '—' });
      this.log('ok', 'ev.upload', { k: ga.trips.length, n: zones.length, r: Math.round(RESERVE * 100) });
      this.analysisTicks = 0;
      return;
    }
    if (++this.analysisTicks < 8) return;
    const { p, ga } = this.result, legs = [];
    ga.trips.forEach((tr, ti) => { const s = [0, ...tr, 0]; for (let k = 0; k + 1 < s.length; k++) legs.push({ from: p.points[s[k]], to: p.points[s[k + 1]], zone: s[k + 1], ti }); });
    this.phase = 'reflight'; this.speed = FLY_SPEED; this.fly = { legs, i: 0, done: 0, hover: 0, next: 'done' };
    this.tripUsed = 0; this.log('info', 'ev.tripStart', { n: 1 });
  }

  stepFly() {
    const F = this.fly, leg = F.legs[F.i];
    if (!leg) return;
    if (F.hover > 0) { F.hover--; this.speed = 0; return; }
    const len = Math.hypot(leg.to[0] - leg.from[0], leg.to[1] - leg.from[1]);
    const move = Math.min(FLY_SPEED * DT, len - F.done);
    F.done += move;
    if (this.phase === 'reflight') { this.tripUsed += move; this.batt = 100 - (this.tripUsed / BATTERY) * 100; }
    else this.batt -= 0.06;
    const f = len ? F.done / len : 1;
    this.pos = [leg.from[0] + (leg.to[0] - leg.from[0]) * f, leg.from[1] + (leg.to[1] - leg.from[1]) * f];
    this.speed = FLY_SPEED;
    if (F.done < len - 1e-9) return;
    F.done = 0; F.i++;
    if (this.phase === 'reflight') {
      if (leg.zone) {
        const area = this.result.p.service[leg.zone];
        this.tripUsed += area; this.batt = 100 - (this.tripUsed / BATTERY) * 100;
        this.result.visited++; F.hover = 3;
        this.log('zone', 'ev.inspect', { z: leg.zone, a: area });
      } else {
        const left = this.batt;
        this.log(left < RESERVE * 100 - 1e-6 ? 'warn' : 'ok', 'ev.tripLand', { n: leg.ti + 1, b: left.toFixed(0) });
        const nextLeg = F.legs[F.i];
        if (nextLeg) { this.batt = 100; this.battName++; this.tripUsed = 0; this.result.trip++; this.log('info', 'ev.swapTrip', { n: nextLeg.ti + 1 }); }
      }
    }
    if (F.i >= F.legs.length) {
      if (this.rtl) { this.phase = 'aborted'; this.speed = 0; this.log('warn', 'ev.rtlLanded'); return; }
      if (F.next === 'analysis') { this.phase = 'analysis'; this.speed = 0; this.log('info', 'ev.landed'); }
      else { this.phase = 'done'; this.speed = 0; this.log('ok', 'ev.done'); }
    }
  }

  returnToLaunch() {
    if (this.phase === 'done' || this.phase === 'aborted' || this.phase === 'analysis') return;
    this.rtl = true; this.log('warn', 'ev.rtl');
    this.goHome('aborted');
  }

  telemetry() {
    const f = this.filtered.length ? this.filtered[this.filtered.length - 1] : null;
    const raw = this.raw.length ? this.raw[this.raw.length - 1] : null;
    const link = Math.round(97 - Math.hypot(this.pos[0], this.pos[1]) * 0.5 + 1.5 * Math.sin(this.time / 9));
    const scanning = this.phase === 'scan';
    return {
      phase: this.phase, time: this.time, batt: Math.max(0, this.batt), battName: this.battName, pos: this.pos, alt: this.pos[1], speed: this.speed,
      rangeRaw: scanning ? raw : null, rangeFiltered: scanning ? f : null, canShoot: scanning && isStable(this.raw),
      correction: scanning ? standoffCorrection(f) : 0, link, gps: 15, current: scanning ? this.order(Math.min(this.k, this.R * this.C - 1)) : null,
    };
  }
}

export const SIM = { DT, BATTERY, RESERVE, TARGET: RANGEFINDER.targetM, TOL: RANGEFINDER.toleranceM };
