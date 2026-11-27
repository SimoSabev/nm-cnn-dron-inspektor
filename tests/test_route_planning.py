"""Тестове за ЕМП частта: pytest -q"""
import itertools
import math

import pytest

from src.route_planning import (RoutingProblem, exact_solution, genetic_algorithm,
                                is_feasible, nearest_neighbor, random_problem,
                                split_tour, total_distance, trip_energy)


def line_problem(battery):
    # база в 0, зони на 1, 2, 3 m по права, без оглед
    return RoutingProblem([(0, 0), (1, 0), (2, 0), (3, 0)], [0, 0, 0, 0], battery)


def test_one_trip_when_battery_is_large():
    p = line_problem(100)
    for res in (nearest_neighbor(p), genetic_algorithm(p, seed=1), exact_solution(p)):
        assert is_feasible(p, res.trips)
        assert res.n_trips == 1
        assert math.isclose(res.distance, 6.0)


def test_tight_battery_forces_trips():
    # поотделно: 0->A->0 = 4 <= 5; заедно: 2 + 2.83 + 2 = 6.83 > 5 -> 2 рейса
    p = RoutingProblem([(0, 0), (2, 0), (0, 2)], [0, 0, 0], 5.0)
    for res in (exact_solution(p), nearest_neighbor(p), genetic_algorithm(p)):
        assert is_feasible(p, res.trips)
        assert res.n_trips == 2 and math.isclose(res.distance, 8.0)


def test_inspection_cost_counts_against_battery():
    # без оглед един рейс стига (6.83 <= 7), с оглед 1 на зона – не (8.83 > 7)
    assert exact_solution(RoutingProblem([(0, 0), (2, 0), (0, 2)], [0, 0, 0], 7.0)).n_trips == 1
    assert exact_solution(RoutingProblem([(0, 0), (2, 0), (0, 2)], [0, 1, 1], 7.0)).n_trips == 2


def test_unreachable_zone_rejected():
    with pytest.raises(ValueError):
        RoutingProblem([(0, 0), (10, 0)], [0, 0], 15)


def test_split_is_optimal_for_fixed_order():
    p = random_problem(6, seed=3)
    order = [3, 1, 4, 6, 2, 5]
    best, trips = split_tour(p, order)
    assert [i for t in trips for i in t] == order
    # сравняваме с всички 2^(n-1) начина за разрязване
    brute = math.inf
    for cuts in itertools.product([0, 1], repeat=len(order) - 1):
        groups, cur = [], [order[0]]
        for cut, g in zip(cuts, order[1:]):
            if cut:
                groups.append(cur)
                cur = [g]
            else:
                cur.append(g)
        groups.append(cur)
        if all(trip_energy(p, t) <= p.battery + 1e-9 for t in groups):
            brute = min(brute, total_distance(p, groups))
    assert math.isclose(best, brute)


@pytest.mark.parametrize("seed", range(8))
def test_heuristics_feasible_and_not_better_than_exact(seed):
    p = random_problem(6, seed=seed)
    ex = exact_solution(p)
    nn = nearest_neighbor(p)
    ga = genetic_algorithm(p, seed=seed, generations=150)
    for r in (ex, nn, ga):
        assert is_feasible(p, r.trips)
        assert math.isclose(r.distance, total_distance(p, r.trips))
    assert ex.distance <= nn.distance + 1e-9
    assert ex.distance <= ga.distance + 1e-9


def test_ga_finds_optimum_on_small_instances():
    hits = 0
    for seed in range(10):
        p = random_problem(7, seed=seed)
        if math.isclose(genetic_algorithm(p, seed=0).distance, exact_solution(p).distance):
            hits += 1
    assert hits >= 9


def test_ga_reproducible_and_history_monotone():
    p = random_problem(15, seed=2)
    a = genetic_algorithm(p, seed=5)
    b = genetic_algorithm(p, seed=5)
    assert a.trips == b.trips
    assert all(x >= y - 1e-12 for x, y in zip(a.history, a.history[1:]))


def test_exact_refuses_large_n():
    with pytest.raises(ValueError):
        exact_solution(random_problem(10, seed=0), max_n=9)
