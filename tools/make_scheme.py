"""Генерира web/how.html – пълната схема „Как работи“ на български и английски.
Карти и стрелки са с абсолютни координати (px), за да се редактират лесно тук.
Пускане от корена: python -m tools.make_scheme

Generates web/how.html, the full "How it works" diagram in Bulgarian and English.
"""
from __future__ import annotations

from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "web" / "how.html"
W, H = 2480, 1904
GREY, VIOLET, AMB, CY = "#8D97A3", "#A99BFF", "#5A4318", "#234652"


class Scheme:
    def __init__(self, lang: str):
        self.lang, self.parts, self.mk = lang, [], 0

    def tr(self, bg_en):
        return bg_en[0] if self.lang == "bg" else bg_en[1]

    def _svg(self, left, top, w, h, path, head, color, dash, label):
        style = (f"position:absolute;left:{left}px;top:{top}px;width:{w}px;height:{h}px;overflow:visible;fill:none;"
                 f"stroke:{color};stroke-width:2;stroke-linecap:round;stroke-linejoin:round" + (f";stroke-dasharray:{dash}" if dash else ""))
        acc = f'role="img" aria-label="{self.tr(label)}"' if label else 'aria-hidden="true"'
        if head:
            self.mk += 1
            mid = f"h-{self.lang}-{self.mk}"
            defs = (f'<defs><marker id="{mid}" orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible">'
                    f'<path d="M0 0 L4 2 L0 4 Z" fill="{color}" stroke="none" style="stroke:none;fill:{color}"/></marker></defs>')
            p = f'<path d="{path}" marker-end="url(#{mid})"></path>'
        else:
            defs, p = "", f'<path d="{path}"></path>'
        self.parts.append(f'<svg {acc} width="{w}" height="{h}" viewBox="0 0 {w} {h}" preserveAspectRatio="none" style="{style}">{defs}{p}</svg>')

    def harrow(self, xa, y, xb, head=True, color=GREY, dash=None, label=None):
        hh = 4 if head else 0
        if xb > xa:
            n = xb - xa
            self._svg(xa, y - 4, n, 8, f"M 0 4 L {n - hh} 4", head, color, dash, label)
        else:
            n = xa - xb
            self._svg(xb, y - 4, n, 8, f"M {n} 4 L {hh} 4", head, color, dash, label)

    def varrow(self, x, ya, yb, head=True, color=GREY, dash=None, label=None):
        hh = 4 if head else 0
        if yb > ya:
            n = yb - ya
            self._svg(x - 4, ya, 8, n, f"M 4 0 L 4 {n - hh}", head, color, dash, label)
        else:
            n = ya - yb
            self._svg(x - 4, yb, 8, n, f"M 4 {n} L 4 {hh}", head, color, dash, label)

    def card(self, l, t, title, kid, tech, w=256, h=176, bd="#2E3740", bg="#1B2229"):
        self.parts.append(
            f'<div class="card" style="left:{l}px;top:{t}px;width:{w}px;height:{h}px;background:{bg};border-color:{bd}"><span>'
            f'<b>{self.tr(title)}</b><br>{self.tr(kid)}<br><span class="tech">{tech if isinstance(tech, str) else self.tr(tech)}</span></span></div>')

    def label(self, l, t, w, text, color="#AEB6C0", align="center"):
        self.parts.append(f'<div class="lbl" style="left:{l}px;top:{t}px;width:{w}px;text-align:{align};color:{color}">{self.tr(text) if isinstance(text, tuple) else text}</div>')

    def raw(self, html):
        self.parts.append(html)


def build(lang: str) -> str:
    s = Scheme(lang)
    for t, hgt, bg in [(176, 240, "#12171C"), (464, 400, "#17150F"), (912, 240, "#16140F"), (1200, 544, "#0F181C")]:
        s.raw(f'<div class="band" style="top:{t}px;height:{hgt}px;background:{bg}"></div>')
    # стрелки (под картите)
    s.harrow(632, 296, 537, label=("От далекомера към камерата: снимай само при стабилни 3 m", "From rangefinder to camera: shoot only at a steady 3 m"))
    s.varrow(408, 384, 471, label=("От Снимка към Нарязване", "From Photo to Tiling"))
    s.harrow(536, 560, 631, label=("От Нарязване към Невронна мрежа", "From Tiling to Neural network"))
    s.harrow(888, 560, 983, label=("От Невронна мрежа към решението", "From Neural network to the decision"))
    s.harrow(1240, 560, 1335, label=("Ако да: към Карта 0/1 като 1", "If yes: to the 0/1 map as 1"))
    s.varrow(1112, 648, 735, label=("Ако не: 0, чисто", "If no: 0, clean"))
    s.harrow(1208, 776, 1421, head=False)
    s.varrow(1421, 776, 649, label=("От 0 чисто към Карта 0/1", "From 0 clean to the 0/1 map"))
    s.varrow(1507, 648, 888, head=False)
    s.harrow(1507, 888, 408, head=False)
    s.varrow(408, 888, 943, label=("От Карта 0/1 към Рекурсивно обхождане", "From the 0/1 map to Recursive fill"))
    s.harrow(536, 1032, 631, label=("Към Зони", "To Zones"))
    s.harrow(888, 1032, 983, label=("Към Сортиране", "To Sorting"))
    s.varrow(1112, 1120, 1176, head=False)
    s.harrow(1112, 1176, 408, head=False)
    s.varrow(408, 1176, 1375, label=("От Сортиране към Задача за маршрута", "From Sorting to the Routing problem"))
    s.harrow(536, 1464, 584, head=False)
    s.varrow(584, 1288, 1640, head=False)
    for y, lab in [(1288, ("Към Най-близък съсед", "To Nearest neighbour")), (1464, ("Към Генетичен алгоритъм", "To Genetic algorithm")), (1640, ("Към Точно решение", "To Exact solution"))]:
        s.harrow(584, y, 631, label=lab)
    s.harrow(888, 1288, 936, head=False)
    s.harrow(888, 1640, 936, head=False)
    s.varrow(936, 1288, 1640, head=False)
    s.harrow(888, 1464, 983, label=("От трите метода към Сравнение", "From the three methods to Comparison"))
    s.harrow(1240, 1464, 1335, label=("Към План за полета", "To Flight plan"))
    s.harrow(1592, 1464, 2168, head=False)
    s.varrow(2168, 1464, 385, label=("От План за полета към Повторен полет", "From Flight plan to Re-flight"))
    s.harrow(2040, 296, 1945, label=("От Повторен полет към УЗ проверка на място", "From Re-flight to on-site ultrasonic check"))
    s.harrow(1688, 296, 1593, label=("От УЗ проверка към Отчет", "From ultrasonic check to Report"))
    s.varrow(2168, 208, 152, head=False, color=VIOLET, dash="7 6")
    s.harrow(408, 152, 2168, head=False, color=VIOLET, dash="7 6")
    s.varrow(408, 152, 207, color=VIOLET, dash="7 6", label=("Обратно към Снимка: следващата инспекция", "Back to Photo: the next inspection"))
    # заглавие
    s.raw(f'<div class="ttl">{s.tr(("Как работи Дрон инспектор", "How Drone Inspector works"))}</div>')
    s.raw(f'<div class="sub">{s.tr(("Чети отляво надясно, ред по ред отгоре надолу. Всяко квадратче е една стъпка. На всяка стрелка пише какво точно минава към следващата стъпка. Сивият ред в квадратчето е функцията в кода и пример.", "Read left to right, row by row from the top. Each box is one step. Each arrow says exactly what goes to the next step. The grey line in a box is the function in the code and an example."))}</div>')
    # карти
    s.card(280, 208, ("1. Снимка на стената", "1. Photo of the wall"), ("Дронът лети ред по ред и снима само когато е точно на 3 m от стената.", "The drone flies row by row and shoots only when it is exactly 3 m from the wall."), ("RGB кадър · H × W × 3", "RGB frame · H × W × 3"))
    s.card(632, 208, ("УЗ далекомер", "Ultrasonic rangefinder"), ("Пищи и слуша ехото, за да знае колко е далеч стената. Медианата маха грешните ехота от витлата.", "It chirps and listens for the echo to know how far the wall is. A median filter drops false echoes from the props."), "ultrasound.is_stable · 3.00 ± 0.15 m")
    s.card(1336, 208, ("13. Отчет", "13. Report"), ("Всички зони: снимка отблизо, дълбочина, клас на бетона, какво да се ремонтира първо.", "Every zone: close-up photo, depth, concrete grade, what to repair first."), ("PDF / CSV за инженера", "PDF / CSV for the engineer"))
    s.card(1688, 208, ("12. УЗ проверка на място", "12. On-site ultrasonic check"), ("Инженерът опира два датчика до стената. Звукът заобикаля под пукнатината, и така се мери колко е дълбока.", "The engineer presses two probes to the wall. Sound goes around under the crack, which tells how deep it is."), "h = x·√(Tc² − Ts²) / Ts")
    s.card(2040, 208, ("11. Повторен полет", "11. Re-flight"), ("Дронът лети само до зоните и ги снима отблизо, пак на 3 m.", "The drone flies only to the zones and photographs them close up, again at 3 m."), ("База → зони → База", "Base → zones → Base"))
    s.card(280, 472, ("2. Нарязване", "2. Tiling"), ("Снимката се реже на квадратчета. Размерът им в метри идва от разстоянието.", "The photo is cut into squares. Their size in metres comes from the distance."), "slice_into_tiles · 227 × 227 px", bd=AMB)
    s.card(632, 472, ("3. Невронна мрежа", "3. Neural network"), ("Гледа всяко квадратче и казва колко е сигурна, че има пукнатина.", "Looks at every square and says how sure it is that there is a crack."), ("MobileNetV2 · ŷ от 0 до 1", "MobileNetV2 · ŷ from 0 to 1"), bd=AMB)
    s.raw(f'<div class="dia"><span><b>{s.tr(("Сигурна ли е<br>поне 32 %?", "Is it at least<br>32 % sure?"))}</b><br>ŷ ≥ 0.32</span></div>')
    s.raw(f'<div class="zero"><span><b>{s.tr(("0 · чисто", "0 · clean"))}</b><br>{s.tr(("не се огледва повторно", "no re-inspection"))}</span></div>')
    s.card(1336, 472, ("4. Карта 0/1", "4. 0/1 map"), ("Таблица 20 × 30: 1 = пукнатина, 0 = чисто. Само тя минава нататък.", "A 20 × 30 table: 1 = crack, 0 = clean. Only this goes further."), "results/crack_map.npy", bd=AMB)
    s.card(280, 944, ("5. Рекурсивно обхождане", "5. Recursive fill"), ("Тръгва от пукнатина и посещава всяка съседна, после нейните съседи, като в лабиринт.", "Starts at a crack and visits every neighbour, then theirs, like in a maze."), "find_zones · 8 · O(R·C)", bd=AMB)
    s.card(632, 944, ("6. Зони", "6. Zones"), ("Всяка група допиращи се пукнатини е една зона: площ, център, граници.", "Every group of touching cracks is one zone: area, centre, bounds."), "Zone(cells, area, center, bbox)", bd=AMB)
    s.card(984, 944, ("7. Сортиране по площ", "7. Sort by area"), ("Най-голямата зона става №1. Сливаме вече подредени половинки.", "The biggest zone becomes #1. We merge halves that are already sorted."), "merge sort · O(k log k)", bd=AMB)
    s.card(280, 1376, ("8. Задача за маршрута", "8. Routing problem"), ("База и центровете на зоните в метри. Огледът харчи батерия според площта. 20 % резерв.", "Base and zone centres in metres. Inspecting costs battery by area. 20 % reserve."), "RoutingProblem · B = 60", bd=CY)
    s.card(632, 1224, ("Най-близък съсед", "Nearest neighbour"), ("Лети до най-близката зона. Бърз, но не най-добър.", "Flies to the closest zone. Fast, but not the best."), "O(n²)", h=128, bd=CY)
    s.card(632, 1400, ("Генетичен алгоритъм", "Genetic algorithm"), ("80 маршрута се кръстосват и мутират, оцеляват по-късите.", "80 routes cross over and mutate, the shorter ones survive."), ("OX · мутация · елит", "OX · mutation · elitism"), h=128, bd=CY)
    s.card(632, 1576, ("Точно решение", "Exact solution"), ("Пробва всички подредби. Само до 8 зони, иначе е бавно.", "Tries every order. Only up to 8 zones, otherwise too slow."), ("n! подредби", "n! orders"), h=128, bd=CY)
    s.card(984, 1376, ("9. Сравнение", "9. Comparison"), ("Всяка зона точно веднъж, никой рейс над батерията. Печели най-късият.", "Every zone exactly once, no trip over the battery. The shortest wins."), "is_feasible", bd=CY)
    s.card(1336, 1376, ("10. План за полета", "10. Flight plan"), ("Най-краткият допустим маршрут, разделен на рейсове по батерията.", "The shortest feasible route, split into trips by battery."), ("рейсове: [[…], […]]", "trips: [[…], […]]"), bd=CY)
    # ленти и етикети
    for top, tag, name, col in [(196, ("ДРОНЪТ", "DRONE"), ("лети, снима, мери", "flies, shoots, measures"), "#AEB6C0"),
                                (484, ("НМ", "NN"), ("невронни мрежи: вижда пукнатините", "neural networks: sees the cracks"), "#F5A524"),
                                (932, ("АСД", "ALGO"), ("алгоритми: групира ги", "algorithms: groups them"), "#F5A524"),
                                (1220, ("ЕМП", "HEUR"), ("евристики: чертае полета", "heuristics: plans the flight"), "#4CC3E6")]:
        s.raw(f'<div class="lane"><span style="color:{col}">{s.tr(tag)}</span><br>{s.tr(name)}</div>'.replace('class="lane"', f'class="lane" style="top:{top}px"'))
    s.label(544, 268, 80, "3.00 m ✓", color="#7BD88F")
    s.label(420, 420, 110, ("RGB снимка", "RGB photo"), align="left")
    s.label(546, 532, 76, ("плочки", "tiles"))
    s.label(898, 532, 76, "ŷ = 0.97")
    s.label(1252, 532, 72, ("да → 1", "yes → 1"))
    s.label(1124, 684, 80, ("не → 0", "no → 0"), align="left")
    s.label(852, 860, 210, ("карта 0/1, 20 × 30", "0/1 map, 20 × 30"))
    s.label(546, 1004, 76, ("етикети", "labels"))
    s.label(898, 1004, 76, ("8 зони", "8 zones"))
    s.label(650, 1148, 220, ("зони, №1 = най-голямата", "zones, #1 = biggest"))
    s.label(1244, 1436, 88, ("най-добрият", "the best"))
    s.label(2180, 916, 80, ("рейсове", "trips"), align="left")
    s.label(1952, 268, 80, ("зони", "zones"))
    s.label(1600, 268, 80, "h, v")
    s.label(1088, 164, 400, ("следващата инспекция започва отново от стъпка 1", "the next inspection starts again at step 1"), color=VIOLET)
    legend = s.tr(("плътна стрелка = данни · пунктир = нов кръг · ромб = решение да / не · рамка: оранжево НМ и АСД, синьо ЕМП · числата са от демо стената",
                   "solid arrow = data · dashed = next round · diamond = yes / no decision · border: orange NN and algorithms, blue heuristics · numbers are from the demo wall"))
    s.raw(f'<div class="legend">{legend}</div>')
    return f'<div class="scheme" data-lang="{lang}" style="width:{W}px;height:{H}px">' + "\n".join(s.parts) + "</div>"


PAGE = """<!doctype html>
<html lang="bg">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Как работи · Дрон инспектор</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/app.css">
<style>
.fit { position: relative; width: 100%; overflow: hidden; }
.scheme { position: relative; transform-origin: 0 0; color: var(--text); }
.scheme .band { position: absolute; left: 64px; width: 2352px; border-radius: 16px; }
.scheme .card { position: absolute; box-sizing: border-box; padding: 12px 14px; display: flex; align-items: center; border: 1px solid; border-radius: 12px; font-size: 14px; line-height: 20px; color: var(--text-2); }
.scheme .card b { font-size: 16px; line-height: 24px; color: #fff; }
.scheme .tech { font-family: var(--mono); font-size: 12px; line-height: 16px; color: var(--faint); }
.scheme .dia { position: absolute; left: 984px; top: 472px; width: 256px; height: 176px; display: flex; align-items: center; justify-content: center; text-align: center; background: var(--crack); color: #1A1204; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); font-size: 14px; line-height: 18px; }
.scheme .zero { position: absolute; left: 1016px; top: 736px; width: 192px; height: 80px; box-sizing: border-box; padding: 8px 12px; display: flex; align-items: center; background: #1B2229; border: 1px dashed #5C6773; border-radius: 12px; font-size: 13px; line-height: 18px; color: var(--text-2); }
.scheme .zero b { color: #fff; }
.scheme .lbl { position: absolute; font-size: 13px; line-height: 16px; font-family: var(--mono); }
.scheme .lane { position: absolute; left: 88px; width: 172px; font-size: 13px; line-height: 18px; color: var(--muted); }
.scheme .lane span { font-family: var(--mono); font-size: 12px; letter-spacing: 1px; }
.scheme .ttl { position: absolute; left: 64px; top: 40px; font-size: 34px; line-height: 40px; font-weight: 600; color: #fff; }
.scheme .sub { position: absolute; left: 64px; top: 90px; width: 1700px; font-size: 16px; line-height: 24px; color: var(--muted); }
.scheme .legend { position: absolute; left: 64px; top: 1792px; width: 2200px; font-size: 14px; line-height: 20px; color: var(--muted); }
</style>
<script type="module" src="js/pages/how.js"></script>
</head>
<body>
<header id="top"></header>
<main id="app" class="page" data-i18n-title="title.how">
<div class="fit" id="fit">
__BG__
__EN__
</div>
</main>
<footer id="foot"></footer>
</body>
</html>
"""


def main() -> None:
    OUT.write_text(PAGE.replace("__BG__", build("bg")).replace("__EN__", build("en")), encoding="utf-8")
    print(f"Записано: {OUT}")


if __name__ == "__main__":
    main()
