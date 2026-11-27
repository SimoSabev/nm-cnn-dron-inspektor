"""Тестове за нарязването и целия конвейер след CNN."""
import numpy as np

from src.pipeline import InspectionConfig, run_pipeline
from src.route_planning import is_feasible
from src.tiling import (assemble_wall, map_errors, probs_to_map,
                        random_crack_mask, slice_into_tiles)


def test_slice_roundtrip():
    img = np.arange(2 * 4 * 3 * 4 * 3).reshape(2 * 4, 3 * 4, 3).astype(np.uint8)
    tiles, shape = slice_into_tiles(img, tile=4)
    assert shape == (2, 3) and tiles.shape == (6, 4, 4, 3)
    assert np.array_equal(tiles[4], img[4:8, 4:8])  # ред 1, колона 1


def test_slice_pads_partial_tiles():
    tiles, shape = slice_into_tiles(np.zeros((10, 9, 3)), tile=4)
    assert shape == (3, 3) and tiles.shape == (9, 4, 4, 3)


def test_assemble_then_slice_restores_mask():
    mask = random_crack_mask(5, 7, 3, seed=1)
    pos = [np.full((8, 8, 3), 255, np.uint8)]
    neg = [np.zeros((8, 8, 3), np.uint8)]
    wall = assemble_wall(mask, pos, neg)
    tiles, shape = slice_into_tiles(wall, tile=8)
    probs = tiles.reshape(len(tiles), -1).mean(axis=1) / 255
    pred = probs_to_map(probs, shape, 0.5)
    assert np.array_equal(pred, mask)
    assert map_errors(pred, mask)["F1"] == 1.0


def test_pipeline_end_to_end():
    mask = random_crack_mask(20, 30, 9, max_len=7, seed=2)
    out = run_pipeline(mask, InspectionConfig())
    assert len(out["zones"]) > 0
    assert sum(z.area for z in out["zones"]) == int(mask.sum())
    for r in out["routes"].values():
        assert is_feasible(out["problem"], r.trips)
    if "exact" in out["routes"]:
        ex = out["routes"]["exact"].distance
        assert all(r.distance >= ex - 1e-9 for r in out["routes"].values())


def test_pipeline_no_cracks():
    out = run_pipeline(np.zeros((4, 4), int))
    assert out["zones"] == [] and out["routes"] == {}
