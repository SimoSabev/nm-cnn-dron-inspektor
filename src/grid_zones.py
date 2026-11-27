"""АСД част: свързани зони с пукнатини в решетката от плочки.

Вход:  карта 0/1 (R реда x C колони), получена от CNN – 1 = плочка с пукнатина.
Изход: списък от зони (свързани области от единици), сортиран по площ.

Алгоритъм:
  1. Рекурсивно обхождане на решетката (както при пътищата в лабиринт):
     от всяка непосетена клетка с 1 "заливаме" всички съседни клетки с 1.
     Сложност: O(R·C) време – всяка клетка се маркира веднъж и се проверява
     от най-много 4 (или 8) съседа; O(R·C) памет за етикетите и стека на
     рекурсията (в най-лошия случай цялата решетка е една зона-"змия").
  2. Сортиране чрез сливане (merge sort, рекурсивно) на зоните по площ
     в низходящ ред. Сложност: O(k log k) за k зони, стабилно.

Общо: O(R·C + k log k), а понеже k <= R·C – O(R·C · log(R·C)) в най-лошия
случай, на практика ~O(R·C), защото k е малко.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from typing import Callable, List, Sequence, Tuple

Cell = Tuple[int, int]

# Посоки на движение – като в лабиринт: горе, долу, ляво, дясно.
MOVES_4: Tuple[Cell, ...] = ((-1, 0), (1, 0), (0, -1), (0, 1))
# С диагоналите – пукнатините често вървят по диагонал през плочките.
MOVES_8: Tuple[Cell, ...] = MOVES_4 + ((-1, -1), (-1, 1), (1, -1), (1, 1))


@dataclass
class Zone:
    """Една свързана зона с пукнатини."""

    zone_id: int
    cells: List[Cell] = field(default_factory=list)

    @property
    def area(self) -> int:
        """Площ в брой плочки."""
        return len(self.cells)

    @property
    def bbox(self) -> Tuple[int, int, int, int]:
        """Обхващащ правоъгълник: (ред_мин, кол_мин, ред_макс, кол_макс)."""
        rows = [r for r, _ in self.cells]
        cols = [c for _, c in self.cells]
        return min(rows), min(cols), max(rows), max(cols)

    @property
    def center(self) -> Tuple[float, float]:
        """Център на тежестта в координати на плочките (ред, колона).

        +0.5, защото центърът на плочка (r, c) е в (r + 0.5, c + 0.5).
        """
        n = len(self.cells)
        r = sum(r for r, _ in self.cells) / n + 0.5
        c = sum(c for _, c in self.cells) / n + 0.5
        return r, c


def _validate(grid: Sequence[Sequence[int]]) -> Tuple[int, int]:
    rows = len(grid)
    if rows == 0:
        return 0, 0
    cols = len(grid[0])
    for row in grid:
        if len(row) != cols:
            raise ValueError("Решетката трябва да е правоъгълна.")
        for v in row:
            if v not in (0, 1):
                raise ValueError("Решетката трябва да съдържа само 0 и 1.")
    return rows, cols


def _fill(grid, labels, r: int, c: int, zone: Zone, moves) -> None:
    """Рекурсивно "заливане" от клетка (r, c).

    Дъно на рекурсията: излизаме извън решетката, клетката е 0 (няма
    пукнатина) или вече е посетена (има етикет).
    """
    if r < 0 or r >= len(grid) or c < 0 or c >= len(grid[0]):
        return
    if grid[r][c] != 1 or labels[r][c] != 0:
        return
    labels[r][c] = zone.zone_id   # маркираме – повече няма да влезем тук
    zone.cells.append((r, c))
    for dr, dc in moves:
        _fill(grid, labels, r + dr, c + dc, zone, moves)


def find_zones(grid: Sequence[Sequence[int]], connectivity: int = 4):
    """Намира всички свързани зони от единици.

    Връща (zones, labels):
      zones  – списък от Zone в реда на откриване (по редове, отгоре надолу);
      labels – матрица R x C: 0 = няма пукнатина, k = номер на зоната (от 1).
    """
    if connectivity not in (4, 8):
        raise ValueError("connectivity трябва да е 4 или 8")
    moves = MOVES_4 if connectivity == 4 else MOVES_8
    rows, cols = _validate(grid)
    labels = [[0] * cols for _ in range(rows)]
    zones: List[Zone] = []

    # Дълбочината на рекурсията може да стигне R·C (зона-"змия").
    needed = rows * cols + 1000
    old_limit = sys.getrecursionlimit()
    if needed > old_limit:
        sys.setrecursionlimit(needed)
    try:
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == 1 and labels[r][c] == 0:
                    zone = Zone(zone_id=len(zones) + 1)
                    _fill(grid, labels, r, c, zone, moves)
                    zones.append(zone)
    finally:
        sys.setrecursionlimit(old_limit)
    return zones, labels


def find_zones_iterative(grid: Sequence[Sequence[int]], connectivity: int = 4):
    """Същото като find_zones, но с явен стек вместо рекурсия.

    Служи само за проверка в тестовете и за много големи решетки, където
    рекурсията би препълнила стека на Python.
    """
    moves = MOVES_4 if connectivity == 4 else MOVES_8
    rows, cols = _validate(grid)
    labels = [[0] * cols for _ in range(rows)]
    zones: List[Zone] = []
    for r0 in range(rows):
        for c0 in range(cols):
            if grid[r0][c0] != 1 or labels[r0][c0] != 0:
                continue
            zone = Zone(zone_id=len(zones) + 1)
            stack = [(r0, c0)]
            labels[r0][c0] = zone.zone_id
            while stack:
                r, c = stack.pop()
                zone.cells.append((r, c))
                for dr, dc in moves:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1 and labels[nr][nc] == 0:
                        labels[nr][nc] = zone.zone_id
                        stack.append((nr, nc))
            zones.append(zone)
    return zones, labels


# ---------------------------------------------------------------------------
# Сортиране чрез сливане
# ---------------------------------------------------------------------------

def merge_sort(items: List, key: Callable = lambda x: x) -> List:
    """Рекурсивно сортиране чрез сливане (нарастващо по key). Стабилно.

    T(n) = 2·T(n/2) + O(n)  =>  T(n) = O(n log n).
    """
    if len(items) <= 1:            # дъно: 0 или 1 елемент е вече сортиран
        return list(items)
    mid = len(items) // 2
    left = merge_sort(items[:mid], key)
    right = merge_sort(items[mid:], key)
    return _merge(left, right, key)


def _merge(left: List, right: List, key: Callable) -> List:
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        # "<=" запазва реда на равните елементи -> стабилност
        if key(left[i]) <= key(right[j]):
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result


def sort_zones_by_area(zones: List[Zone]) -> List[Zone]:
    """Зоните по площ – първо най-голямата.

    При равна площ: по-горната, после по-лявата (детерминиран ред).
    Ключът е (-площ, ред_мин, кол_мин), за да ползваме нарастващо сортиране.
    """
    return merge_sort(zones, key=lambda z: (-z.area, z.bbox[0], z.bbox[1]))


def filter_small_zones(zones: List[Zone], min_area: int = 1) -> List[Zone]:
    """Премахва зони под min_area плочки (напр. единични фалшиви сигнали).

    ВНИМАНИЕ: пропусната пукнатина е по-скъпа от излишна проверка, затова
    по подразбиране min_area = 1 – не изхвърляме нищо.
    """
    return [z for z in zones if z.area >= min_area]
