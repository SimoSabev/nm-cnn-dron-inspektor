"""Тестове за АСД частта: pytest -q"""
import random

import pytest

from src.grid_zones import (find_zones, find_zones_iterative, merge_sort,
                            sort_zones_by_area)


def areas(zones):
    return sorted(z.area for z in zones)


def test_empty_and_no_cracks():
    assert find_zones([])[0] == []
    zones, labels = find_zones([[0, 0], [0, 0]])
    assert zones == [] and labels == [[0, 0], [0, 0]]


def test_single_full_zone():
    zones, _ = find_zones([[1, 1], [1, 1]])
    assert len(zones) == 1 and zones[0].area == 4
    assert zones[0].center == (1.0, 1.0)


def test_diagonal_depends_on_connectivity():
    grid = [[1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]]
    assert len(find_zones(grid, connectivity=4)[0]) == 3
    assert len(find_zones(grid, connectivity=8)[0]) == 1


def test_known_example():
    grid = [[1, 1, 0, 0, 1],
            [0, 1, 0, 0, 1],
            [0, 0, 0, 1, 1],
            [1, 0, 0, 0, 0]]
    zones, labels = find_zones(grid)
    assert areas(zones) == [1, 3, 4]
    assert labels[0][0] == labels[1][1] != 0
    ordered = sort_zones_by_area(zones)
    assert [z.area for z in ordered] == [4, 3, 1]


def test_labels_cover_exactly_the_ones():
    rng = random.Random(1)
    grid = [[int(rng.random() < 0.4) for _ in range(25)] for _ in range(18)]
    zones, labels = find_zones(grid, connectivity=8)
    for r in range(18):
        for c in range(25):
            assert (labels[r][c] != 0) == (grid[r][c] == 1)
    assert sum(z.area for z in zones) == sum(map(sum, grid))


@pytest.mark.parametrize("conn", [4, 8])
@pytest.mark.parametrize("seed", range(10))
def test_recursive_matches_iterative(seed, conn):
    rng = random.Random(seed)
    grid = [[int(rng.random() < 0.45) for _ in range(30)] for _ in range(20)]
    a, la = find_zones(grid, conn)
    b, lb = find_zones_iterative(grid, conn)
    assert la == lb
    assert [sorted(z.cells) for z in a] == [sorted(z.cells) for z in b]


def test_deep_recursion_snake():
    """Зона-"змия" 60x60 -> дълбочина на рекурсията ~1800 (над лимита 1000)."""
    n = 60
    grid = [[1 if (r % 2 == 0 or (r % 4 == 1 and c == n - 1) or (r % 4 == 3 and c == 0)) else 0
             for c in range(n)] for r in range(n)]
    zones, _ = find_zones(grid)
    assert len(zones) == 1


def test_invalid_input():
    with pytest.raises(ValueError):
        find_zones([[1, 2]])
    with pytest.raises(ValueError):
        find_zones([[1, 0], [1]])
    with pytest.raises(ValueError):
        find_zones([[1]], connectivity=6)


@pytest.mark.parametrize("seed", range(20))
def test_merge_sort_matches_sorted(seed):
    rng = random.Random(seed)
    data = [rng.randint(-50, 50) for _ in range(rng.randint(0, 200))]
    assert merge_sort(data) == sorted(data)


def test_merge_sort_is_stable():
    data = [(2, "a"), (1, "b"), (2, "c"), (1, "d")]
    assert merge_sort(data, key=lambda x: x[0]) == [(1, "b"), (1, "d"), (2, "a"), (2, "c")]
