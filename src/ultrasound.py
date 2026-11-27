"""Ултразвук (УЗ): два различни уреда за две различни задачи.

1. УЗ далекомер на дрона (напр. MaxBotix MB1242 / I2CXL-MaxSonar-EZ4, до ~7 m)
   * държи дрона на постоянно разстояние от стената (по подразбиране 3 m);
   * снимка се прави САМО когато разстоянието е стабилно и в допуска;
   * от разстоянието и камерата се смята колко метра стена покрива една плочка.
   Шумът от витлата дава единични „скокове“ и нули -> медианен филтър.
   Ултразвукът през въздух НЕ вижда пукнатини вътре в бетона: той мери само
   разстояние до повърхността.

2. Ръчен УЗ уред за скорост на импулса (UPV) – проверка на място
   * инженерът опира двата датчика ДО стената в зоните, които дронът е намерил;
   * дълбочина на отворена пукнатина по BS 1881-203 (два измервания, косвено
     предаване, датчиците на разстояние x от двете страни на пукнатината):
         h = x · sqrt(Tc² − Ts²) / Ts
     Tc – време през пукнатината, Ts – време по здрав бетон на същото разстояние;
   * качество на бетона по скоростта v = L / t (IS 13311-1):
         > 4.5 km/s отлично · 3.5–4.5 добро · 3.0–3.5 средно · < 3.0 съмнително.
   Формулата приема отворена, въздушна, перпендикулярна на повърхността пукнатина;
   при влага, арматура или наклонена пукнатина резултатът е само ориентир.

Единици: разстояния в m (далекомер) или mm (UPV), времена в µs.
Удобство: mm / µs = km/s, затова скоростта излиза директно в km/s.

---------------------------------------------------------------------------
Ultrasound (EN summary): (1) an ultrasonic rangefinder keeps the drone at a
fixed stand-off distance and gates the camera trigger; the distance also sets
the real size of one 227 px tile. (2) A hand-held ultrasonic pulse velocity
(UPV) tester is used on site in the zones the drone found: crack depth by the
BS 1881-203 Tc–Ts method and concrete quality by pulse velocity (IS 13311-1).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from statistics import median
from typing import Iterable, List, Optional, Sequence

# ---------------------------------------------------------------------------
# 1. Далекомер на дрона
# ---------------------------------------------------------------------------


@dataclass
class RangefinderConfig:
    """Настройки на далекомера и на задържането на разстояние до стената."""

    min_m: float = 0.20        # под това датчикът не мери надеждно
    max_m: float = 7.00        # MB1242: до ~7 m
    target_m: float = 3.00     # желано разстояние до стената
    tolerance_m: float = 0.15  # допуск около целта
    window: int = 5            # колко последни измервания гледаме (медиана)
    max_spread_m: float = 0.10  # колко може да „трепери“ медианата в прозореца


def clean_readings(readings: Iterable[Optional[float]], cfg: RangefinderConfig = RangefinderConfig()) -> List[Optional[float]]:
    """Маркира невалидните измервания с None (нула, извън обхвата, None)."""
    out: List[Optional[float]] = []
    for r in readings:
        out.append(r if (r is not None and cfg.min_m <= r <= cfg.max_m) else None)
    return out


def median_filter(readings: Sequence[Optional[float]], window: int = 5) -> List[Optional[float]]:
    """Плъзгаща медиана по последните `window` ВАЛИДНИ стойности.

    Медианата (не средното) маха единичните скокове от шума на витлата:
    един грешен 0.4 m сред 3.0 m не мести медианата.
    Резултатът е None, докато няма поне половин прозорец валидни стойности.
    """
    if window < 1:
        raise ValueError("window трябва да е >= 1")
    out: List[Optional[float]] = []
    for i in range(len(readings)):
        chunk = [r for r in readings[max(0, i - window + 1): i + 1] if r is not None]
        out.append(median(chunk) if len(chunk) >= (window + 1) // 2 else None)
    return out


def is_stable(readings: Sequence[Optional[float]], cfg: RangefinderConfig = RangefinderConfig()) -> bool:
    """Може ли да се снима сега? Гледат се последните cfg.window измервания.

    Да, ако: всички са валидни, медианата е в допуска около целта и
    разликата между най-голямото и най-малкото е <= cfg.max_spread_m.
    """
    last = clean_readings(readings[-cfg.window:], cfg)
    if len(last) < cfg.window or any(r is None for r in last):
        return False
    vals = [r for r in last if r is not None]
    return abs(median(vals) - cfg.target_m) <= cfg.tolerance_m and max(vals) - min(vals) <= cfg.max_spread_m


def photo_triggers(readings: Sequence[Optional[float]], cfg: RangefinderConfig = RangefinderConfig()) -> List[int]:
    """Индексите на измерванията, при които е позволено да се снима."""
    return [i for i in range(len(readings)) if is_stable(readings[: i + 1], cfg)]


def standoff_correction(distance_m: Optional[float], cfg: RangefinderConfig = RangefinderConfig()) -> float:
    """Колко метра да се придвижи дронът към стената (+) или от нея (−).

    0 в рамките на допуска; при липса на измерване – 0 (не мърдаме на сляпо).
    """
    if distance_m is None:
        return 0.0
    err = distance_m - cfg.target_m
    return 0.0 if abs(err) <= cfg.tolerance_m else round(err, 3)


@dataclass
class Camera:
    """Камера: фокусно разстояние и ширина на сензора в mm, ширина на кадъра в px."""

    focal_mm: float
    sensor_width_mm: float
    image_width_px: int


def ground_sample_distance(distance_m: float, cam: Camera) -> float:
    """Колко метра стена покрива един пиксел (GSD) от разстояние distance_m."""
    if distance_m <= 0:
        raise ValueError("Разстоянието трябва да е > 0")
    return distance_m * cam.sensor_width_mm / (cam.focal_mm * cam.image_width_px)


def tile_size_m(distance_m: float, cam: Camera, tile_px: int = 227) -> float:
    """Колко метра стена покрива една плочка tile_px × tile_px."""
    return ground_sample_distance(distance_m, cam) * tile_px


def distance_for_tile(tile_m: float, cam: Camera, tile_px: int = 227) -> float:
    """Обратното: от колко метра да снимаме, за да е плочката tile_m метра."""
    if tile_m <= 0:
        raise ValueError("tile_m трябва да е > 0")
    return tile_m * cam.focal_mm * cam.image_width_px / (cam.sensor_width_mm * tile_px)


# ---------------------------------------------------------------------------
# 2. Ръчна проверка на място: скорост на импулса и дълбочина на пукнатина
# ---------------------------------------------------------------------------


def pulse_velocity_kms(path_mm: float, time_us: float) -> float:
    """v = L / t. С L в mm и t в µs резултатът е директно в km/s."""
    if path_mm <= 0 or time_us <= 0:
        raise ValueError("Пътят и времето трябва да са > 0")
    return path_mm / time_us


def concrete_quality(velocity_kms: float) -> str:
    """Клас на бетона по скоростта на импулса (IS 13311-1): ключ на английски.

    > 4.5 отличен · 3.5–4.5 добър · 3.0–3.5 среден · < 3.0 съмнителен.
    Таблицата е за директно предаване (през елемента). Измерена по повърхността
    (косвено), скоростта е с 5–20 % по-ниска, т.е. оценката е по-строга.
    """
    if velocity_kms > 4.5:
        return "excellent"
    if velocity_kms >= 3.5:
        return "good"
    if velocity_kms >= 3.0:
        return "medium"
    return "doubtful"


def crack_depth_mm(x_mm: float, tc_us: float, ts_us: float) -> float:
    """Дълбочина на пукнатина по BS 1881-203 (метод Tc–Ts).

    x_mm  – разстоянието от всеки датчик до пукнатината (датчиците са на 2x един от друг);
    tc_us – времето, когато датчиците са от двете страни на пукнатината;
    ts_us – времето по здрав бетон при същото разстояние 2x.
    h = x · sqrt(Tc² − Ts²) / Ts. Пукнатината удължава пътя, значи Tc > Ts.
    """
    if x_mm <= 0 or ts_us <= 0:
        raise ValueError("x и Ts трябва да са > 0")
    if tc_us < ts_us:
        raise ValueError("Tc < Ts: през пукнатината не може да е по-бързо – провери измерването")
    return x_mm * math.sqrt(tc_us ** 2 - ts_us ** 2) / ts_us


def crack_severity(depth_mm: float, cover_mm: float = 30.0) -> str:
    """Груба оценка спрямо защитния бетонов слой над арматурата (cover_mm).

    Това е ПРАВИЛО НА ПРОЕКТА, не норма: истинската оценка е на инженер.
    * 'surface'   – по-плитка от половината защитен слой;
    * 'cover'     – в защитния слой;
    * 'rebar'     – стига до арматурата или по-дълбоко -> приоритет за ремонт.
    """
    if depth_mm < 0:
        raise ValueError("Дълбочината не може да е отрицателна")
    if depth_mm < 0.5 * cover_mm:
        return "surface"
    if depth_mm < cover_mm:
        return "cover"
    return "rebar"


@dataclass
class FieldCheck:
    """Една проверка на място в зона от плана на полета."""

    zone: int
    x_mm: float
    tc_us: float
    ts_us: float
    cover_mm: float = 30.0

    @property
    def velocity_kms(self) -> float:
        # по здрав бетон: път 2x за време Ts (косвено предаване, по повърхността)
        return pulse_velocity_kms(2 * self.x_mm, self.ts_us)

    @property
    def depth_mm(self) -> float:
        return crack_depth_mm(self.x_mm, self.tc_us, self.ts_us)

    def summary(self) -> dict:
        d = self.depth_mm
        return {
            "zone": self.zone,
            "depth_mm": round(d, 1),
            "velocity_kms": round(self.velocity_kms, 2),
            "quality": concrete_quality(self.velocity_kms),
            "severity": crack_severity(d, self.cover_mm),
        }
