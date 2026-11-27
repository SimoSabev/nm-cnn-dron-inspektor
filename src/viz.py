"""Графики за картата, зоните и маршрутите."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional

import matplotlib.pyplot as plt
import numpy as np

TRIP_COLORS = ["#d62728", "#1f77b4", "#2ca02c", "#9467bd", "#ff7f0e",
               "#8c564b", "#e377c2", "#17becf", "#bcbd22", "#7f7f7f"]


def plot_zones(labels: np.ndarray, zones, ax=None, tile_m: float = 0.5, title: str = "Зони с пукнатини"):
    """Всяка зона в свой цвят + номерът ѝ по площ (1 = най-голямата)."""
    ax = ax or plt.gca()
    rows, cols = labels.shape
    extent = (0, cols * tile_m, 0, rows * tile_m)
    rank = np.zeros_like(labels)
    for i, z in enumerate(zones, 1):
        rank[labels == z.zone_id] = i
    cmap = plt.get_cmap("tab20", max(len(zones), 1) + 1)
    shown = np.ma.masked_where(rank == 0, rank)
    ax.imshow(np.zeros_like(labels), cmap="Greys", vmin=0, vmax=1, extent=extent)
    ax.imshow(shown, cmap=cmap, extent=extent, interpolation="nearest")
    for i, z in enumerate(zones, 1):
        r, c = z.center
        ax.text(c * tile_m, (rows - r) * tile_m, f"#{i}", ha="center", va="center",
                fontsize=8, weight="bold", color="black",
                bbox=dict(boxstyle="round,pad=0.15", fc="white", alpha=0.8, lw=0))
    ax.set_title(title)
    ax.set_xlabel("x, m")
    ax.set_ylabel("височина, m")
    return ax


def plot_route(problem, result, labels: Optional[np.ndarray] = None, ax=None,
               tile_m: float = 0.5, title: Optional[str] = None):
    """Рейсовете на дрона – всеки рейс в различен цвят."""
    ax = ax or plt.gca()
    if labels is not None:
        rows, cols = labels.shape
        ax.imshow(labels > 0, cmap="Greys", alpha=0.35, extent=(0, cols * tile_m, 0, rows * tile_m))
    pts = problem.points
    for k, trip in enumerate(result.trips):
        path = [0] + list(trip) + [0]
        xs = [pts[i][0] for i in path]
        ys = [pts[i][1] for i in path]
        ax.plot(xs, ys, "-o", color=TRIP_COLORS[k % len(TRIP_COLORS)], lw=1.8, ms=4,
                label=f"рейс {k + 1}")
    ax.plot(*pts[0], marker="s", ms=11, color="black", label="база", clip_on=False)
    ax.set_title(title or f"{result.method}: {result.distance:.1f} m, {result.n_trips} рейса")
    ax.legend(fontsize=7, loc="upper right")
    ax.set_xlabel("x, m")
    ax.set_ylabel("височина, m")
    return ax


def plot_pipeline(crack_map: np.ndarray, result: Dict, path: Optional[Path] = None):
    """Горе: карта 0/1, зони, сравнение; долу: маршрутите по методи."""
    routes = result["routes"]
    tile_m = result["config"].tile_m
    rows, cols = crack_map.shape
    fig, axes = plt.subplots(2, 3, figsize=(16, 8.6))
    axes[0, 0].imshow(crack_map, cmap="Reds", extent=(0, cols * tile_m, 0, rows * tile_m))
    axes[0, 0].set_title("1. Карта 0/1 от CNN")
    plot_zones(result["labels"], result["zones"], axes[0, 1], tile_m,
               title="2. Зони (АСД), #1 = най-голямата")
    ax = axes[0, 2]
    names = [r.method for r in routes.values()]
    dists = [r.distance for r in routes.values()]
    bars = ax.barh(names, dists, color=TRIP_COLORS[:len(names)])
    ax.bar_label(bars, fmt="%.1f m", padding=3)
    ax.invert_yaxis()
    ax.set_title("3. Обща дължина на маршрута (ЕМП)")
    ax.set_xlim(0, max(dists) * 1.25 if dists else 1)
    for ax, r in zip(axes[1], routes.values()):
        plot_route(result["problem"], r, result["labels"], ax, tile_m)
    for ax in axes[1][len(routes):]:
        ax.axis("off")
    fig.tight_layout()
    if path:
        fig.savefig(path, dpi=130)
        plt.close(fig)
    return fig
