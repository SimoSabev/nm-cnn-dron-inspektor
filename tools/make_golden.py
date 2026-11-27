"""Еталонни резултати от src/ за проверка, че web/js/core.js и web/js/ultrasound.js
смятат същото. Пускане от корена: python -m tools.make_golden

Golden results from the Python code, used by web/tests/parity.test.mjs.
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

from src.grid_zones import find_zones, sort_zones_by_area
from src.pipeline import InspectionConfig, zones_to_problem
from src.route_planning import RoutingProblem, exact_solution, nearest_neighbor, split_tour
from src.tiling import random_crack_mask
from src import ultrasound as us

OUT = Path(__file__).resolve().parents[1] / "web" / "tests" / "golden.json"


def main() -> None:
    cases = []
    for seed, (rows, cols, cracks) in enumerate([(8, 10, 3), (12, 15, 5), (20, 30, 9), (16, 28, 7), (10, 10, 4), (25, 40, 14)]):
        mask = random_crack_mask(rows, cols, cracks, max_len=6, seed=seed + 1)
        grid = mask.astype(int).tolist()
        zones, _ = find_zones(grid, connectivity=8)
        zones = sort_zones_by_area(zones)
        cfg = InspectionConfig(battery=200.0)
        case = {"grid": grid, "zones": [{"area": z.area, "bbox": list(z.bbox), "center": list(z.center)} for z in zones]}
        if zones:
            p = zones_to_problem(zones, mask.shape, cfg)
            nn = nearest_neighbor(p)
            rng = random.Random(seed)
            orders = []
            for _ in range(3):
                o = list(range(1, p.n + 1)); rng.shuffle(o)
                cost, trips = split_tour(p, o)
                orders.append({"order": o, "cost": cost, "trips": trips})
            case.update({"battery": cfg.battery, "points": [list(x) for x in p.points], "service": p.service,
                         "nn": {"trips": nn.trips, "distance": nn.distance}, "splits": orders})
            if p.n <= 7:
                ex = exact_solution(p, max_n=7)
                case["exact"] = {"distance": ex.distance}
        cases.append(case)

    # Тясна батерия – принуждава много рейсове
    p = RoutingProblem([(0, 0), (3, 1), (5, 4), (1, 6), (7, 2), (6, 6)], [0, 2, 1, 3, 2, 1], 22.0)
    tight = {"points": [list(x) for x in p.points], "service": p.service, "battery": p.battery,
             "nn": {"trips": nearest_neighbor(p).trips, "distance": nearest_neighbor(p).distance},
             "exact": {"distance": exact_solution(p).distance}}

    ultra = []
    for x, h, v in [(100, 40, 4.0), (150, 60, 3.6), (80, 5, 4.6), (120, 0, 3.1)]:
        ts = 2 * x / v
        tc = 2 * math.sqrt(x * x + h * h) / v
        fc = us.FieldCheck(zone=1, x_mm=x, tc_us=tc, ts_us=ts)
        ultra.append({"x": x, "tc": tc, "ts": ts, "summary": fc.summary()})
    filt = [3.0, 3.02, 0.4, 2.99, 3.01, None, 3.0, 3.6, 3.0, 2.98]
    rf = {"readings": filt, "median": us.median_filter(filt, 5),
          "stable": [us.is_stable(filt[: i + 1]) for i in range(len(filt))]}

    OUT.write_text(json.dumps({"cases": cases, "tight": tight, "ultrasound": ultra, "rangefinder": rf}), encoding="utf-8")
    print(f"Записано: {OUT} ({len(cases)} карти)")


if __name__ == "__main__":
    main()
