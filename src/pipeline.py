"""Интеграция на конвейера (роля "Ръководител / интегратор").

  снимка ─► [НМ] CNN: вероятност за всяка плочка ─► карта 0/1
        ─► [АСД] рекурсивно обхождане: свързани зони, сортирани по площ
        ─► [ЕМП] маршрут на дрона през центровете на зоните (батерия)
        ─► план за повторния полет

Тук е частта СЛЕД невронната мрежа – тя приема готова карта 0/1, затова може
да се пусне и без TensorFlow (напр. с карта от results/crack_map.npy,
записана от тетрадката по НМ, или със случайна демонстрационна карта).

Пускане от корена на хранилището:
    python -m src.pipeline                       # демонстрационна карта
    python -m src.pipeline --map results/crack_map.npy
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

from .grid_zones import Zone, filter_small_zones, find_zones, sort_zones_by_area
from .route_planning import (RouteResult, RoutingProblem, exact_solution,
                             genetic_algorithm, is_feasible, nearest_neighbor)
from .tiling import random_crack_mask


@dataclass
class InspectionConfig:
    tile_m: float = 0.5                  # колко метра стена покрива една плочка
    base_xy: Tuple[float, float] = (0.0, 0.0)  # базата: долу вляво пред стената
    battery: float = 60.0                # енергия на батерия (≈ метри полет)
    inspect_cost_per_tile: float = 1.0   # енергия за оглед на 1 плочка от зона
    connectivity: int = 8                # 8 – пукнатините вървят и по диагонал
    min_area: int = 1                    # не изхвърляме нищо (пълнота!)
    exact_max_n: int = 8                 # точно решение само при <= 8 зони
    ga_seed: int = 0


def zones_to_problem(zones: List[Zone], grid_shape: Tuple[int, int],
                     cfg: InspectionConfig) -> RoutingProblem:
    """Зони (в координати на плочките) -> задача за маршрута (в метри).

    Ред 0 е най-горният ред плочки, затова височината е y = (R - ред) · tile_m.
    """
    rows, _ = grid_shape
    points = [cfg.base_xy]
    service = [0.0]
    for z in zones:
        r, c = z.center
        points.append((c * cfg.tile_m, (rows - r) * cfg.tile_m))
        service.append(cfg.inspect_cost_per_tile * z.area)
    return RoutingProblem(points, service, cfg.battery)


def run_pipeline(crack_map: np.ndarray, cfg: Optional[InspectionConfig] = None) -> Dict:
    """Пуска АСД + ЕМП частта върху карта 0/1 и връща всички междинни резултати."""
    cfg = cfg or InspectionConfig()
    grid = np.asarray(crack_map).astype(int).tolist()

    # [АСД] зони + сортиране
    zones, labels = find_zones(grid, connectivity=cfg.connectivity)
    zones = sort_zones_by_area(filter_small_zones(zones, cfg.min_area))

    out: Dict = {"config": cfg, "zones": zones, "labels": np.array(labels), "routes": {}}
    if not zones:
        return out

    # [ЕМП] маршрут
    problem = zones_to_problem(zones, crack_map.shape, cfg)
    out["problem"] = problem
    routes: Dict[str, RouteResult] = {}
    routes["nn"] = nearest_neighbor(problem)
    routes["ga"] = genetic_algorithm(problem, seed=cfg.ga_seed,
                                     initial=None)
    if problem.n <= cfg.exact_max_n:
        routes["exact"] = exact_solution(problem, max_n=cfg.exact_max_n)
    for r in routes.values():
        assert is_feasible(problem, r.trips), f"{r.method}: недопустимо решение"
    out["routes"] = routes
    return out


def report(result: Dict) -> str:
    """Текстов отчет за потребителя (инженера по поддръжка)."""
    zones: List[Zone] = result["zones"]
    lines = [f"Открити зони с пукнатини: {len(zones)}"]
    for i, z in enumerate(zones, 1):
        r0, c0, r1, c1 = z.bbox
        lines.append(f"  {i:>2}. площ {z.area:>3} плочки | редове {r0}-{r1}, колони {c0}-{c1}")
    zone_names = {k + 1: f"#{k + 1}" for k in range(len(zones))}
    for key, r in result["routes"].items():
        trips = " | ".join("База→" + "→".join(zone_names[i] for i in t) + "→База" for t in r.trips)
        lines.append(f"{r.method:<22} {r.distance:8.2f} m, {r.n_trips} рейса, {r.seconds * 1000:8.1f} ms")
        lines.append(f"    {trips}")
    return "\n".join(lines)


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description="Дрон инспектор: зони + маршрут от карта 0/1")
    ap.add_argument("--map", type=Path, help=".npy файл с карта 0/1 (R x C)")
    ap.add_argument("--rows", type=int, default=20)
    ap.add_argument("--cols", type=int, default=30)
    ap.add_argument("--cracks", type=int, default=9)
    ap.add_argument("--seed", type=int, default=2)
    ap.add_argument("--battery", type=float, default=60.0)
    ap.add_argument("--out", type=Path, default=Path("results"))
    args = ap.parse_args(argv)

    crack_map = (np.load(args.map) if args.map else
                 random_crack_mask(args.rows, args.cols, args.cracks, max_len=7, seed=args.seed))
    cfg = InspectionConfig(battery=args.battery)
    result = run_pipeline(crack_map, cfg)
    print(report(result))

    args.out.mkdir(parents=True, exist_ok=True)
    import matplotlib
    matplotlib.use("Agg")  # запис във файл, без прозорец
    from .viz import plot_pipeline
    path = args.out / "pipeline_demo.png"
    plot_pipeline(crack_map, result, path)
    summary = {k: {"разстояние_m": round(r.distance, 2), "рейсове": r.trips,
                   "време_ms": round(r.seconds * 1000, 2)} for k, r in result["routes"].items()}
    (args.out / "pipeline_demo.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2),
                                                 encoding="utf-8")
    print(f"\nЗаписано: {path}")


if __name__ == "__main__":
    main()
