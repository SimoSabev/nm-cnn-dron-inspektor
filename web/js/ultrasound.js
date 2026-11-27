// Ултразвук – същите формули като src/ultrasound.py.
// Ultrasound – same formulas as src/ultrasound.py.

export const RANGEFINDER = { minM: 0.2, maxM: 7.0, targetM: 3.0, toleranceM: 0.15, window: 5, maxSpreadM: 0.1 };

export function cleanReadings(readings, cfg = RANGEFINDER) {
  return readings.map(r => (r != null && r >= cfg.minM && r <= cfg.maxM ? r : null));
}

function median(v) {
  const s = v.slice().sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Плъзгаща медиана по последните `window` валидни стойности. */
export function medianFilter(readings, window = 5) {
  return readings.map((_, i) => {
    const chunk = readings.slice(Math.max(0, i - window + 1), i + 1).filter(r => r != null);
    return chunk.length >= (window + 1) >> 1 ? median(chunk) : null;
  });
}

/** Може ли да се снима: последните `window` измервания са валидни, около целта и стабилни. */
export function isStable(readings, cfg = RANGEFINDER) {
  const last = cleanReadings(readings.slice(-cfg.window), cfg);
  if (last.length < cfg.window || last.some(r => r == null)) return false;
  return Math.abs(median(last) - cfg.targetM) <= cfg.toleranceM && Math.max(...last) - Math.min(...last) <= cfg.maxSpreadM;
}

export function standoffCorrection(distanceM, cfg = RANGEFINDER) {
  if (distanceM == null) return 0;
  const err = distanceM - cfg.targetM;
  return Math.abs(err) <= cfg.toleranceM ? 0 : Math.round(err * 1000) / 1000;
}

export function groundSampleDistance(distanceM, cam) {
  return (distanceM * cam.sensorWidthMm) / (cam.focalMm * cam.imageWidthPx);
}

export function tileSizeM(distanceM, cam, tilePx = 227) {
  return groundSampleDistance(distanceM, cam) * tilePx;
}

export function distanceForTile(tileM, cam, tilePx = 227) {
  return (tileM * cam.focalMm * cam.imageWidthPx) / (cam.sensorWidthMm * tilePx);
}

/** v = L / t; mm / µs = km/s. */
export function pulseVelocityKms(pathMm, timeUs) {
  if (!(pathMm > 0) || !(timeUs > 0)) throw new Error('L и t трябва да са > 0');
  return pathMm / timeUs;
}

/** IS 13311-1: > 4.5 отличен · 3.5–4.5 добър · 3.0–3.5 среден · < 3.0 съмнителен. */
export function concreteQuality(v) {
  if (v > 4.5) return 'excellent';
  if (v >= 3.5) return 'good';
  if (v >= 3.0) return 'medium';
  return 'doubtful';
}

/** BS 1881-203: h = x · sqrt(Tc² − Ts²) / Ts. */
export function crackDepthMm(xMm, tcUs, tsUs) {
  if (!(xMm > 0) || !(tsUs > 0)) throw new Error('x и Ts трябва да са > 0');
  if (tcUs < tsUs) throw new Error('Tc < Ts');
  return (xMm * Math.sqrt(tcUs * tcUs - tsUs * tsUs)) / tsUs;
}

/** Правило на проекта (не норма): спрямо защитния слой над арматурата. */
export function crackSeverity(depthMm, coverMm = 30) {
  if (depthMm < 0.5 * coverMm) return 'surface';
  if (depthMm < coverMm) return 'cover';
  return 'rebar';
}

export function fieldCheck({ zone, xMm, tcUs, tsUs, coverMm = 30 }) {
  const depth = crackDepthMm(xMm, tcUs, tsUs), v = pulseVelocityKms(2 * xMm, tsUs);
  return {
    zone, depthMm: Math.round(depth * 10) / 10, velocityKms: Math.round(v * 100) / 100,
    quality: concreteQuality(v), severity: crackSeverity(depth, coverMm),
  };
}
