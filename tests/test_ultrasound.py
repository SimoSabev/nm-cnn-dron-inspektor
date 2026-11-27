"""Тестове за модула за ултразвук (далекомер + ръчна проверка на място)."""
import math

import pytest

from src.ultrasound import (Camera, FieldCheck, RangefinderConfig, clean_readings,
                            concrete_quality, crack_depth_mm, crack_severity,
                            distance_for_tile, ground_sample_distance, is_stable,
                            median_filter, photo_triggers, pulse_velocity_kms,
                            standoff_correction, tile_size_m)

CFG = RangefinderConfig()
CAM = Camera(focal_mm=4.0, sensor_width_mm=6.0, image_width_px=4000)


# --- далекомер ---------------------------------------------------------------

def test_clean_marks_out_of_range_as_none():
    assert clean_readings([0.0, 0.1, 3.0, 9.0, None]) == [None, None, 3.0, None, None]


def test_median_filter_removes_single_spike():
    raw = [3.0, 3.01, 0.4, 2.99, 3.0]  # 0.4 – ехо от витлото
    assert median_filter(raw, 5)[-1] == pytest.approx(3.0)


def test_median_filter_waits_for_enough_samples():
    assert median_filter([3.0], 5) == [None]
    assert median_filter([3.0, 3.0, 3.0], 5)[-1] == 3.0


def test_stable_only_inside_tolerance():
    assert is_stable([3.0, 3.02, 2.98, 3.01, 3.0], CFG)
    assert not is_stable([3.4, 3.4, 3.4, 3.4, 3.4], CFG)       # твърде далеч
    assert not is_stable([3.0, 3.0, None, 3.0, 3.0], CFG)       # липсващо измерване
    assert not is_stable([2.9, 3.1, 2.9, 3.1, 2.95], CFG)       # трепери повече от 0.10 m
    assert not is_stable([3.0, 3.0, 3.0], CFG)                  # още няма пълен прозорец


def test_photo_triggers_skip_unstable_part():
    raw = [3.5, 3.4, 3.25] + [3.0] * 6
    trig = photo_triggers(raw, CFG)
    assert trig and min(trig) >= 7  # чак когато последните 5 са около 3.0


def test_standoff_correction_sign_and_deadband():
    assert standoff_correction(3.05) == 0.0
    assert standoff_correction(3.5) == pytest.approx(0.5)    # да се приближи
    assert standoff_correction(2.5) == pytest.approx(-0.5)   # да се отдалечи
    assert standoff_correction(None) == 0.0


def test_tile_size_and_inverse():
    gsd = ground_sample_distance(3.0, CAM)
    assert gsd == pytest.approx(3.0 * 6.0 / (4.0 * 4000))
    t = tile_size_m(3.0, CAM)
    assert distance_for_tile(t, CAM) == pytest.approx(3.0)
    assert tile_size_m(6.0, CAM) == pytest.approx(2 * t)    # двойно по-далеч -> двойно по-голяма плочка


def test_bad_inputs_raise():
    with pytest.raises(ValueError):
        ground_sample_distance(0, CAM)
    with pytest.raises(ValueError):
        median_filter([3.0], 0)


# --- ръчна проверка на място (UPV) -------------------------------------------

def test_velocity_units_mm_per_us_is_km_per_s():
    assert pulse_velocity_kms(300, 75) == pytest.approx(4.0)


@pytest.mark.parametrize("v,expected", [(4.8, "excellent"), (4.5, "good"), (3.5, "good"),
                                        (3.2, "medium"), (3.0, "medium"), (2.5, "doubtful")])
def test_quality_bands(v, expected):
    assert concrete_quality(v) == expected


def test_crack_depth_matches_geometry():
    # Права пукнатина с дълбочина h: пътят през върха е 2·sqrt(x² + h²) срещу 2x по здрав бетон.
    v, x, h = 4.0, 150.0, 60.0                # km/s = mm/µs
    ts = 2 * x / v
    tc = 2 * math.sqrt(x ** 2 + h ** 2) / v
    assert crack_depth_mm(x, tc, ts) == pytest.approx(h)


def test_crack_depth_zero_when_times_equal_and_error_when_tc_smaller():
    assert crack_depth_mm(100, 50, 50) == 0
    with pytest.raises(ValueError):
        crack_depth_mm(100, 40, 50)


def test_severity_against_cover():
    assert crack_severity(10, 30) == "surface"
    assert crack_severity(20, 30) == "cover"
    assert crack_severity(35, 30) == "rebar"


def test_field_check_summary():
    x, h, v = 100.0, 40.0, 4.0
    fc = FieldCheck(zone=3, x_mm=x, tc_us=2 * math.sqrt(x * x + h * h) / v, ts_us=2 * x / v)
    s = fc.summary()
    assert s["zone"] == 3 and s["depth_mm"] == pytest.approx(40.0, abs=0.1)
    assert s["velocity_kms"] == pytest.approx(4.0) and s["quality"] == "good"
    assert s["severity"] == "rebar"
