"""ЕМП част: маршрут на дрона през центровете на зоните с ограничение на батерията.

Модел (учебен):
  * Точка 0 е базата (зарядната станция) пред стената, в точки 1..n са
    центровете на зоните с пукнатини. Координатите са в метри в равнината
    на стената; разстоянието е евклидово.
  * Огледът на зона i струва s_i енергия (дронът облита плочките ѝ отблизо):
    s_i = inspect_cost_per_tile · площ_i.
  * С пълна батерия дронът разполага с B единици енергия (1 единица ≈ 1 m
    полет). Един полет ("рейс") тръгва от базата, обикаля няколко зони и се
    връща в базата, като разход = полет + огледи <= B. В базата батерията
    се сменя и започва нов рейс.
  * Цел: да се огледат всички зони с минимално общо изминато разстояние.

Това е задача за пътуващия търговец с ограничение на дължината на всеки
рейс (Distance-Constrained Vehicle Routing Problem). При B = безкрайност
тя е точно задачата за пътуващия търговец – значи е NP-трудна и за голям
брой зони използваме евристики.

Методи:
  * nearest_neighbor   – евристика "най-близък съсед" с проверка на батерията, O(n²);
  * genetic_algorithm  – генетичен алгоритъм върху пермутации на зоните;
  * exact_solution     – пълно изчерпване на пермутациите + оптимално
                         разделяне на рейсове, O(n!·n²) – само за малко зони.
"""

from __future__ import annotations

import itertools
import math
import random
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

Point = Tuple[float, float]
Trips = List[List[int]]  # списък от рейсове; рейс = индексите на зоните (1..n)


# ---------------------------------------------------------------------------
# Задача и помощни функции
# ---------------------------------------------------------------------------

@dataclass
class RoutingProblem:
    """Входни данни: база + зони, матрица на разстоянията, цена на огледа, батерия."""

    points: List[Point]          # points[0] = база, points[1..n] = центрове на зони
    service: List[float]         # service[0] = 0, service[i] = енергия за оглед на зона i
    battery: float               # енергия на една батерия
    dist: List[List[float]] = field(init=False)

    def __post_init__(self) -> None:
        if len(self.points) != len(self.service):
            raise ValueError("points и service трябва да са с еднаква дължина")
        if self.service[0] != 0:
            raise ValueError("service[0] (базата) трябва да е 0")
        self.dist = distance_matrix(self.points)
        for i in range(1, self.n + 1):
            alone = self.dist[0][i] + self.service[i] + self.dist[i][0]
            if alone > self.battery + 1e-9:
                raise ValueError(
                    f"Зона {i} е недостижима: само тя изисква {alone:.1f} > батерия {self.battery:.1f}"
                )

    @property
    def n(self) -> int:
        """Брой зони (без базата)."""
        return len(self.points) - 1


def distance_matrix(points: Sequence[Point]) -> List[List[float]]:
    """Матрица на евклидовите разстояния – O(n²)."""
    m = len(points)
    d = [[0.0] * m for _ in range(m)]
    for i in range(m):
        for j in range(i + 1, m):
            d[i][j] = d[j][i] = math.dist(points[i], points[j])
    return d


def trip_energy(problem: RoutingProblem, trip: Sequence[int]) -> float:
    """Енергия за един рейс: база -> зоните по ред -> база (полет + огледи)."""
    if not trip:
        return 0.0
    d = problem.dist
    e = d[0][trip[0]] + d[trip[-1]][0]
    for a, b in zip(trip, trip[1:]):
        e += d[a][b]
    return e + sum(problem.service[i] for i in trip)


def trip_distance(problem: RoutingProblem, trip: Sequence[int]) -> float:
    """Само изминатото разстояние за рейса (без огледите)."""
    return trip_energy(problem, trip) - sum(problem.service[i] for i in trip)


def total_distance(problem: RoutingProblem, trips: Trips) -> float:
    return sum(trip_distance(problem, t) for t in trips)


def is_feasible(problem: RoutingProblem, trips: Trips) -> bool:
    """Всяка зона е посетена точно веднъж и никой рейс не надвишава батерията."""
    visited = [i for t in trips for i in t]
    if sorted(visited) != list(range(1, problem.n + 1)):
        return False
    return all(trip_energy(problem, t) <= problem.battery + 1e-9 for t in trips)


@dataclass
class RouteResult:
    method: str
    trips: Trips
    distance: float
    seconds: float
    history: List[float] = field(default_factory=list)  # за ГА: най-доброто по поколения

    @property
    def n_trips(self) -> int:
        return len(self.trips)


# ---------------------------------------------------------------------------
# Оптимално разделяне на обиколка на рейсове (split)
# ---------------------------------------------------------------------------

def split_tour(problem: RoutingProblem, order: Sequence[int]) -> Tuple[float, Trips]:
    """При ЗАДАДЕН ред на зоните намира най-доброто им разделяне на рейсове.

    V[j] = минимално разстояние, за да се огледат първите j зони от реда.
    V[j+1] = min_i ( V[i] + разстояние на рейса order[i..j] ), ако рейсът
    се побира в батерията. Сложност O(n²) (на практика O(n·L), L – брой
    зони в един рейс, защото вътрешният цикъл спира при изтощена батерия).
    Използва се като "декодер" в генетичния алгоритъм и в точния метод.
    """
    d, s, B = problem.dist, problem.service, problem.battery
    n = len(order)
    INF = float("inf")
    V = [0.0] + [INF] * n
    pred = [0] * (n + 1)
    for i in range(n):
        if V[i] == INF:
            continue
        energy = 0.0
        travel = 0.0
        for j in range(i, n):
            cur = order[j]
            if j == i:
                travel = d[0][cur]
            else:
                travel += d[order[j - 1]][cur]
            energy += s[cur]
            if travel + energy + d[cur][0] > B + 1e-9:
                break
            cost = travel + d[cur][0]
            if V[i] + cost < V[j + 1]:
                V[j + 1] = V[i] + cost
                pred[j + 1] = i
    trips: Trips = []
    j = n
    while j > 0:
        i = pred[j]
        trips.append(list(order[i:j]))
        j = i
    trips.reverse()
    return V[n], trips


# ---------------------------------------------------------------------------
# Евристика 1: най-близък съсед
# ---------------------------------------------------------------------------

def nearest_neighbor(problem: RoutingProblem) -> RouteResult:
    """От текущата позиция летим до най-близката неогледана зона, ако след
    нея батерията стига, за да се върнем в базата. Ако за нито една зона не
    стига – връщаме се, сменяме батерията и започваме нов рейс.

    Сложност: O(n²) – n избора, всеки преглежда до n кандидата.
    """
    t0 = time.perf_counter()
    d, s, B = problem.dist, problem.service, problem.battery
    unvisited = set(range(1, problem.n + 1))
    trips: Trips = []
    while unvisited:
        cur, left, trip = 0, B, []
        while True:
            best, best_d = None, float("inf")
            for j in unvisited:
                can_return = d[cur][j] + s[j] + d[j][0] <= left + 1e-9
                if can_return and (d[cur][j] < best_d or (d[cur][j] == best_d and j < best)):
                    best, best_d = j, d[cur][j]
            if best is None:
                break
            left -= d[cur][best] + s[best]
            trip.append(best)
            unvisited.remove(best)
            cur = best
        trips.append(trip)  # винаги поне 1 зона – всяка зона е достижима сама
    return RouteResult("Най-близък съсед", trips, total_distance(problem, trips),
                       time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Евристика 2: генетичен алгоритъм
# ---------------------------------------------------------------------------

def _order_crossover(p1: List[int], p2: List[int], rng: random.Random) -> List[int]:
    """Кръстосване с подредба (OX): копираме отрязък от p1, останалите гени
    добавяме в реда, в който се срещат в p2. Резултатът винаги е пермутация."""
    n = len(p1)
    a, b = sorted(rng.sample(range(n), 2))
    child: List[Optional[int]] = [None] * n
    child[a:b + 1] = p1[a:b + 1]
    taken = set(p1[a:b + 1])
    fill = [g for g in p2 if g not in taken]
    k = 0
    for i in range(n):
        if child[i] is None:
            child[i] = fill[k]
            k += 1
    return child  # type: ignore[return-value]


def _mutate(ind: List[int], rng: random.Random) -> None:
    """Мутация: обръщане на отрязък (премахва "кръстосани" отсечки) или размяна."""
    n = len(ind)
    a, b = sorted(rng.sample(range(n), 2))
    if rng.random() < 0.7:
        ind[a:b + 1] = reversed(ind[a:b + 1])
    else:
        ind[a], ind[b] = ind[b], ind[a]


def genetic_algorithm(
    problem: RoutingProblem,
    pop_size: int = 80,
    generations: int = 400,
    crossover_rate: float = 0.9,
    mutation_rate: float = 0.3,
    tournament_k: int = 3,
    elite: int = 2,
    patience: int = 120,
    seed: Optional[int] = 0,
    initial: Optional[List[List[int]]] = None,
) -> RouteResult:
    """Генетичен алгоритъм.

    Хромозома: пермутация на зоните 1..n (ред на облитане).
    Декодиране: split_tour разделя пермутацията на рейсове по батерията.
    Приспособимост: общото разстояние (по-малко = по-добре).
    Оператори: турнирна селекция, кръстосване OX, мутация обръщане/размяна,
    елитизъм (най-добрите `elite` преминават без промяна).
    Спиране: `generations` поколения или `patience` поколения без подобрение.
    """
    t0 = time.perf_counter()
    rng = random.Random(seed)
    n = problem.n
    genes = list(range(1, n + 1))
    if n <= 2:  # тривиален случай – пробваме всички пермутации
        best = min((split_tour(problem, list(p)) for p in itertools.permutations(genes)),
                   key=lambda x: x[0])
        return RouteResult("Генетичен алгоритъм", best[1], best[0], time.perf_counter() - t0, [best[0]])

    cache: Dict[Tuple[int, ...], float] = {}

    def fitness(ind: List[int]) -> float:
        key = tuple(ind)
        if key not in cache:
            cache[key] = split_tour(problem, ind)[0]
        return cache[key]

    population = [list(p) for p in (initial or [])][:pop_size]
    while len(population) < pop_size:
        ind = genes[:]
        rng.shuffle(ind)
        population.append(ind)

    def tournament() -> List[int]:
        return min(rng.sample(population, tournament_k), key=fitness)

    best = min(population, key=fitness)
    best_cost = fitness(best)
    history = [best_cost]
    stale = 0
    for _ in range(generations):
        population.sort(key=fitness)
        new_pop = [ind[:] for ind in population[:elite]]
        while len(new_pop) < pop_size:
            p1, p2 = tournament(), tournament()
            child = _order_crossover(p1, p2, rng) if rng.random() < crossover_rate else p1[:]
            if rng.random() < mutation_rate:
                _mutate(child, rng)
            new_pop.append(child)
        population = new_pop
        gen_best = min(population, key=fitness)
        if fitness(gen_best) < best_cost - 1e-9:
            best, best_cost, stale = gen_best[:], fitness(gen_best), 0
        else:
            stale += 1
        history.append(best_cost)
        if stale >= patience:
            break
    cost, trips = split_tour(problem, best)
    return RouteResult("Генетичен алгоритъм", trips, cost, time.perf_counter() - t0, history)


# ---------------------------------------------------------------------------
# Точно решение (за малко зони)
# ---------------------------------------------------------------------------

def exact_solution(problem: RoutingProblem, max_n: int = 9) -> RouteResult:
    """Пълно изчерпване: всички n! пермутации, всяка разделена оптимално.

    Защо е точно: всяко допустимо решение (набор от рейсове) е разделяне на
    някаква пермутация – тази, получена при залепване на рейсовете един след
    друг. split_tour намира НАЙ-ДОБРОТО разделяне на всяка пермутация, значи
    минимумът по всички пермутации е глобалният оптимум.
    Сложност: O(n! · n²) -> само при n <= max_n.
    """
    n = problem.n
    if n > max_n:
        raise ValueError(f"Точното решение е твърде бавно за n = {n} > {max_n}")
    t0 = time.perf_counter()
    best_cost, best_trips = float("inf"), []
    for perm in itertools.permutations(range(1, n + 1)):
        # Рейс и обратният му имат еднаква дължина (симетрични разстояния), но
        # пермутациите не са симетрични заради разделянето – затова обхождаме всички.
        cost, trips = split_tour(problem, perm)
        if cost < best_cost - 1e-12:
            best_cost, best_trips = cost, trips
    return RouteResult("Точно (изчерпване)", best_trips, best_cost, time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Случайни задачи за експериментите
# ---------------------------------------------------------------------------

def random_problem(
    n: int,
    seed: int = 0,
    wall_w: float = 30.0,
    wall_h: float = 15.0,
    base: Point = (0.0, 0.0),
    battery_factor: float = 1.6,
    max_service: float = 6.0,
) -> RoutingProblem:
    """n зони, разпръснати случайно по стена wall_w x wall_h метра.

    Батерията е battery_factor x (най-скъпия единичен рейс) – така всяка зона
    е достижима, а при повече зони са нужни няколко рейса.
    """
    rng = random.Random(seed)
    pts = [base] + [(rng.uniform(0, wall_w), rng.uniform(0, wall_h)) for _ in range(n)]
    service = [0.0] + [rng.uniform(1.0, max_service) for _ in range(n)]
    worst = max(2 * math.dist(base, p) + s for p, s in zip(pts[1:], service[1:]))
    return RoutingProblem(pts, service, battery_factor * worst)
