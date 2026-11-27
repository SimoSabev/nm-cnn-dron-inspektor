"""Генерира презентацията по НМ: presentation/dron_inspektor_NM.pptx

Пуснете СЛЕД като тетрадката 01_NM е изпълнена – скриптът автоматично вмъква
графиките от results/ и числата от results/nm_metrics.csv. Ако някой файл
липсва, на мястото му остава сиво поле с указание.

    python presentation/build_presentation.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "results"
DIAG = ROOT / "docs" / "diagrams"
OUT = ROOT / "presentation" / "dron_inspektor_NM.pptx"

NAVY = RGBColor(0x14, 0x2B, 0x4C)
BLUE = RGBColor(0x1A, 0x73, 0xE8)
GREEN = RGBColor(0x18, 0x80, 0x38)
ORANGE = RGBColor(0xE3, 0x74, 0x00)
GREY = RGBColor(0x5F, 0x63, 0x68)
LIGHT = RGBColor(0xF1, 0xF3, 0xF4)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
FONT = "Arial"

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
W, H = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]


def _run(p, text, size, bold=False, color=NAVY, italic=False):
    r = p.add_run()
    r.text = text
    r.font.size, r.font.bold, r.font.italic, r.font.name = Pt(size), bold, italic, FONT
    r.font.color.rgb = color
    return r


def textbox(slide, x, y, w, h, lines, size=18, color=NAVY, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    """lines: низ или списък; елемент, започващ с '• ', става точка; '  – ' – подточка."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for i, line in enumerate([lines] if isinstance(lines, str) else lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = Pt(6)
        bullet = line.startswith("• ")
        body = line[2:] if bullet else line
        bold = body.startswith("**")
        body = body.strip("*") if bold else body
        line = ("• " + body) if bullet else body
        if line.startswith("  – "):
            _run(p, "   –  " + line[4:], size - 2, color=GREY)
        elif line.startswith("• "):
            _run(p, "•  ", size, bold=True, color=BLUE)
            _run(p, line[2:], size, bold=bold, color=color)
        else:
            _run(p, line, size, bold=bold, color=color)
    return tb


def new_slide(title, tag=None, tag_color=BLUE):
    s = prs.slides.add_slide(BLANK)
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.18), H)
    bar.fill.solid(); bar.fill.fore_color.rgb = tag_color; bar.line.fill.background()
    textbox(s, Inches(0.55), Inches(0.35), Inches(10.5), Inches(0.9), [f"**{title}"], size=30)
    if tag:
        b = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, W - Inches(1.75), Inches(0.45), Inches(1.3), Inches(0.5))
        b.fill.solid(); b.fill.fore_color.rgb = tag_color; b.line.fill.background()
        tf = b.text_frame; tf.paragraphs[0].alignment = PP_ALIGN.CENTER
        _run(tf.paragraphs[0], tag, 14, bold=True, color=WHITE)
    n = len(prs.slides)
    textbox(s, W - Inches(1.0), H - Inches(0.5), Inches(0.7), Inches(0.3), str(n), size=11, color=GREY,
            align=PP_ALIGN.RIGHT)
    return s


def picture(slide, path, x, y, w, h, hint=None):
    """Вмъква картинка, вписана в кутията; ако липсва – сиво поле с указание."""
    path = Path(path)
    if path.exists():
        from PIL import Image
        iw, ih = Image.open(path).size
        scale = min(w / iw, h / ih)
        pw, ph = int(iw * scale), int(ih * scale)
        return slide.shapes.add_picture(str(path), x + (w - pw) // 2, y + (h - ph) // 2, pw, ph)
    box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    box.fill.solid(); box.fill.fore_color.rgb = LIGHT
    box.line.color.rgb = RGBColor(0xDA, 0xDC, 0xE0); box.line.dash_style = 4
    tf = box.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    _run(tf.paragraphs[0], hint or f"Вмъкнете {path.relative_to(ROOT)}\n(след изпълнение на тетрадката по НМ)",
         14, color=GREY, italic=True)
    return box


def table(slide, rows, x, y, w, h, col_w=None, size=14, header_color=NAVY):
    shape = slide.shapes.add_table(len(rows), len(rows[0]), x, y, w, h)
    t = shape.table
    if col_w:
        for i, cw in enumerate(col_w):
            t.columns[i].width = int(w * cw)
    for r, row in enumerate(rows):
        for c, val in enumerate(row):
            cell = t.cell(r, c)
            cell.text = ""
            p = cell.text_frame.paragraphs[0]
            _run(p, str(val), size, bold=(r == 0), color=WHITE if r == 0 else NAVY)
            cell.fill.solid()
            cell.fill.fore_color.rgb = header_color if r == 0 else (LIGHT if r % 2 else WHITE)
    return shape


def read_metrics():
    f = RES / "nm_metrics.csv"
    if not f.exists():
        return None
    with open(f, encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


# ---------------------------------------------------------------------------
# 1. Заглавие
s = prs.slides.add_slide(BLANK)
bg = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, W, H); bg.fill.solid(); bg.fill.fore_color.rgb = NAVY
bg.line.fill.background()
textbox(s, Inches(0.9), Inches(2.0), Inches(11.5), Inches(1.2), ["**Дрон инспектор на сгради"], size=48, color=WHITE)
textbox(s, Inches(0.9), Inches(3.2), Inches(11.5), Inches(1.0),
        ["Конволюционна мрежа за откриване на пукнатини в бетон"], size=24, color=RGBColor(0xC6, 0xDA, 0xFC))
textbox(s, Inches(0.9), Inches(4.6), Inches(11.5), Inches(1.4),
        ["Интердисциплинарен проект · Тема 2 · НМ · АСД · ЕМП", "Екип: …………………… · XIIВ · 2026/2027"],
        size=18, color=WHITE)

# 2. Задачата
s = new_slide("Задачата: от снимка до план за полет")
steps = [("📷", "Снимка на стена", "дронът снима\nбетонна стена", NAVY),
         ("🧠", "CNN · НМ", "плочки 227×227\n→ P(пукнатина)", BLUE),
         ("🧮", "Зони · АСД", "рекурсивно обхождане\n→ свързани зони", GREEN),
         ("🧭", "Маршрут · ЕМП", "НС vs генетичен\nалгоритъм, батерия", ORANGE),
         ("✅", "Повторен полет", "само над\nповредените зони", NAVY)]
bw, gap = Inches(2.15), Inches(0.35)
x0 = (W - (5 * bw + 4 * gap)) // 2
for i, (ic, t, d, col) in enumerate(steps):
    x = x0 + i * (bw + gap)
    b = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(1.9), bw, Inches(2.1))
    b.fill.solid(); b.fill.fore_color.rgb = col; b.line.fill.background()
    tf = b.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER; _run(p, ic + "\n", 26, color=WHITE)
    p = tf.add_paragraph(); p.alignment = PP_ALIGN.CENTER; _run(p, t, 17, bold=True, color=WHITE)
    p = tf.add_paragraph(); p.alignment = PP_ALIGN.CENTER; _run(p, d, 12, color=WHITE)
    if i < 4:
        a = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, x + bw + Inches(0.05), Inches(2.8), gap - Inches(0.1), Inches(0.35))
        a.fill.solid(); a.fill.fore_color.rgb = GREY; a.line.fill.background()
textbox(s, Inches(0.9), Inches(4.5), Inches(11.5), Inches(2.5), [
    "• Задача на мрежата: бинарна класификация на плочка – „пукнатина“ / „без пукнатина“",
    "• Изход: вероятност ŷ = σ(z) ∈ (0, 1) → праг → карта 0/1 на стената",
    "• **Най-важна метрика: ПЪЛНОТА – пропусната пукнатина е по-скъпа от излишна проверка",
], size=18)

# 3. Данни
s = new_slide("Данни: Concrete Crack Images for Classification")
textbox(s, Inches(0.55), Inches(1.4), Inches(6.0), Inches(5.5), [
    "• 40 000 RGB снимки 227 × 227",
    "• 2 балансирани класа: 20 000 с пукнатина, 20 000 без",
    "• Нарязани от 458 снимки 4032 × 3024 на бетонни сгради (ODTÜ, Анкара)",
    "• Özgenel (2019), Mendeley Data, DOI 10.17632/5y9wdsg2zt.2 · лиценз CC BY 4.0",
    "**Разделяне (стратифицирано, seed 42):",
    "  – обучаващо 70 % · валидационно 15 % · тестово 15 %",
    "  – тестовото – само веднъж, накрая",
    "**Аугментация (само обучаващо):",
    "  – огледало, завъртане на 90°, яркост, контраст",
], size=17)
picture(s, RES / "nm_examples.png", Inches(6.8), Inches(1.5), Inches(6.1), Inches(4.8))

# 4. Собствен CNN
s = new_slide("Модел 1: собствен CNN", "НМ")
table(s, [["Блок", "Слоеве", "Изход"],
          ["вход", "Rescaling 1/255", "128×128×3"],
          ["1", "2 × [Conv 3×3, 32 → BN → ReLU] → MaxPool", "64×64×32"],
          ["2", "2 × [Conv 3×3, 64 → BN → ReLU] → MaxPool", "32×32×64"],
          ["3", "2 × [Conv 3×3, 128 → BN → ReLU] → MaxPool", "16×16×128"],
          ["4", "Conv 3×3, 256 → BN → ReLU → GlobalAvgPool", "256"],
          ["глава", "Dropout 0.4 → Dense 64 ReLU (L2) → Dropout 0.3", "64"],
          ["изход", "Dense 1, сигмоида", "ŷ ∈ (0, 1)"]],
      Inches(0.55), Inches(1.4), Inches(7.6), Inches(4.2), col_w=[0.13, 0.62, 0.25], size=13)
textbox(s, Inches(8.5), Inches(1.4), Inches(4.4), Inches(5.5), [
    "**Защо така",
    "• Пукнатината е локален признак → малки филтри 3×3",
    "• Два 3×3 подред = поле 5×5 с по-малко параметри и още една нелинейност",
    "• GlobalAvgPool вместо Flatten → ~100× по-малко параметри, без значение къде е пукнатината",
    "• 128 px вместо 227 → 3× по-малко изчисления",
    "• Adam, α = 10⁻³, бинарна кросентропия",
], size=15)

# 5. Формули
s = new_slide("Формули", "НМ")
textbox(s, Inches(0.55), Inches(1.4), Inches(12.3), Inches(5.8), [
    "**Конволюция:   z(i,j) = b + Σᵤ Σᵥ Σ꜀  K(u,v,c) · x(i+u, j+v, c)",
    "**ReLU:   g(z) = max(0, z)            Сигмоида:   ŷ = σ(z) = 1 / (1 + e⁻ᶻ)",
    "**Пакетна нормализация:   ẑ = (z − μ_B) / √(σ²_B + ε),    z′ = γ·ẑ + β",
    "**Загуба (бинарна кросентропия + L2):",
    "     J = −(1/m) Σᵢ [ yᵢ·log ŷᵢ + (1 − yᵢ)·log(1 − ŷᵢ) ] + λ Σ‖W‖²,    λ = 10⁻⁴",
    "**Adam:   mₜ = β₁mₜ₋₁ + (1−β₁)gₜ,    vₜ = β₂vₜ₋₁ + (1−β₂)gₜ²,    w ← w − α · m̂ₜ / (√v̂ₜ + ε)",
    "     α = 10⁻³,  β₁ = 0.9,  β₂ = 0.999",
    "**Метрики:   P = TP / (TP + FP)      R = TP / (TP + FN)      F₁ = 2PR / (P + R)",
], size=18)

# 6. Регуляризация
s = new_slide("Срещу преобучение (справочници 1–4)", "НМ")
table(s, [["Техника", "Какво прави", "Къде"],
          ["L2 регуляризация", "наказва големите тегла: + λΣ‖W‖²", "всички Conv, Dense 64"],
          ["Dropout", "изключва случайни неврони при обучение", "0.4 и 0.3 в главата"],
          ["Пакетна нормализация", "нормализира активациите → по-стабилно и бързо обучение", "след всяка Conv"],
          ["Ранно спиране", "спира, ако val_loss не се подобри 5 епохи; връща най-добрите тегла", "callback"],
          ["ReduceLROnPlateau", "намалява α × 0.3 при застой", "callback"],
          ["Аугментация", "огледало, rot90, яркост, контраст", "само обучаващото"]],
      Inches(0.55), Inches(1.5), Inches(12.2), Inches(4.2), col_w=[0.22, 0.53, 0.25], size=15)

# 7. MobileNetV2
s = new_slide("Модел 2: MobileNetV2 – трансферно обучение", "НМ")
textbox(s, Inches(0.55), Inches(1.4), Inches(6.3), Inches(5.6), [
    "**Идея: признаците от ImageNet (1.2 млн. снимки) – ръбове, линии, текстури – вече ги има",
    "**MobileNetV2 – създадена за мобилни устройства → подходяща за бордовия компютър на дрон",
    "• дълбочинно разделими конволюции: ~8–9× по-малко умножения от обикновената 3×3",
    "• обърнати остатъчни блокове с линейно „гърло“",
    "**Два етапа",
    "  – 1) замразена основа, обучава се само главата (GAP → Dropout → Dense 1), α = 10⁻³",
    "  – 2) фино настройване на последните 30 слоя, α = 10⁻⁵",
    "• вход 160 × 160, preprocess_input → [−1, 1]",
], size=16)
table(s, [["Конволюция 3×3, 128 → 128 канала", "Умножения на пиксел"],
          ["обикновена: 9 · Cᵢₙ · Cₒᵤₜ", "147 456"],
          ["дълбочинна: 9 · Cᵢₙ", "1 152"],
          ["+ точкова 1×1: Cᵢₙ · Cₒᵤₜ", "16 384"],
          ["дълбочинно разделима (общо)", "17 536  →  8.4× по-малко"]],
      Inches(7.1), Inches(1.7), Inches(5.8), Inches(2.6), col_w=[0.58, 0.42], size=14)
textbox(s, Inches(7.1), Inches(4.6), Inches(5.8), Inches(2.2), [
    "• Обучаеми параметри: етап 1 – само главата (~1 300); етап 2 – ~1.5 млн.",
    "• BN слоевете на основата остават в режим на извод (training=False)",
], size=14)

# 8. Криви
s = new_slide("Криви на обучение", "НМ")
picture(s, RES / "nm_curves_own.png", Inches(0.4), Inches(1.3), Inches(12.5), Inches(2.8))
picture(s, RES / "nm_curves_tl.png", Inches(0.4), Inches(4.25), Inches(12.5), Inches(2.8))

# 9. Праг
s = new_slide("Избор на праг: пълнота ≥ 99 %", "НМ")
thr = json.loads((RES / "thresholds.json").read_text(encoding="utf-8")) if (RES / "thresholds.json").exists() else {}
textbox(s, Inches(0.55), Inches(1.4), Inches(5.2), Inches(5.6), [
    "• FN – пропусната пукнатина → риск за сградата",
    "• FP – излишна плочка → няколко секунди батерия",
    "**Правило: най-високият праг, при който пълнотата на ВАЛИДАЦИОННОТО е ≥ 99 %",
    "• така максимизираме прецизността при гарантирана пълнота",
    "• тестовото множество не участва в избора",
] + ([f"**Избрани прагове: " + ", ".join(f"{k} = {v:.2f}" for k, v in thr.items())] if thr else []), size=17)
picture(s, RES / "nm_threshold.png", Inches(6.0), Inches(1.5), Inches(7.0), Inches(4.8))

# 10. Резултати
s = new_slide("Резултати върху тестовото множество", "НМ")
m = read_metrics()
if m:
    rows = [["Модел", "Праг", "Точност", "Прецизност", "Пълнота", "F1", "FN", "FP", "Параметри"]]
    for r in m:
        rows.append([r["модел"], f"{float(r['праг']):.2f}", f"{float(r['точност']):.4f}",
                     f"{float(r['прецизност']):.4f}", f"{float(r['пълнота']):.4f}", f"{float(r['F1']):.4f}",
                     r["FN"], r["FP"], f"{int(float(r['параметри'])):,}".replace(",", " ")])
else:
    rows = [["Модел", "Праг", "Точност", "Прецизност", "Пълнота", "F1", "FN", "FP", "Параметри"],
            ["Собствен CNN"] + ["…"] * 8, ["MobileNetV2"] + ["…"] * 8]
table(s, rows, Inches(0.55), Inches(1.35), Inches(12.2), Inches(1.3), size=13,
      col_w=[0.18, 0.07, 0.1, 0.11, 0.1, 0.09, 0.07, 0.07, 0.21])
picture(s, RES / "nm_confusion.png", Inches(0.55), Inches(3.0), Inches(6.2), Inches(4.0))
picture(s, RES / "nm_errors.png", Inches(6.9), Inches(3.0), Inches(6.0), Inches(4.0))

# 11. Сравнение
s = new_slide("Силни и слаби страни", "НМ")
table(s, [["", "Собствен CNN", "MobileNetV2 (трансферно)"],
          ["Силни", "малко параметри; пълен контрол; не зависи от външни тегла",
           "готови признаци → висока точност с малко епохи; оптимизирана за мобилни устройства"],
          ["Слаби", "обучава се по-дълго от нулата; при малко данни се преобучава по-лесно",
           "повече параметри; ImageNet ≠ бетон; изисква точна предобработка"],
          ["Кога", "много слаб бордов компютър", "по подразбиране за дрона"]],
      Inches(0.55), Inches(1.5), Inches(12.2), Inches(3.0), col_w=[0.12, 0.44, 0.44], size=15)
textbox(s, Inches(0.55), Inches(4.9), Inches(12.2), Inches(2.0), [
    "**Ограничения на набора: един кампус, сходно осветление, един тип бетон, центрирани плочки.",
    "Реални снимки от дрон: размазване, сенки, фуги, мръсотия → нужен е допълнителен тест с реални снимки.",
], size=16)

# 12. Конвейер
s = new_slide("От снимка до карта 0/1 → зони → маршрут")
picture(s, RES / "nm_wall_map.png", Inches(0.4), Inches(1.3), Inches(12.5), Inches(2.6))
picture(s, RES / "pipeline_from_cnn.png" if (RES / "pipeline_from_cnn.png").exists() else RES / "pipeline_demo.png",
        Inches(2.2), Inches(3.95), Inches(8.9), Inches(3.2))

# 13. АСД и ЕМП
s = new_slide("АСД и ЕМП накратко", tag_color=GREEN)
textbox(s, Inches(0.55), Inches(1.35), Inches(6.0), Inches(2.6), [
    "**АСД – рекурсивно обхождане (flood fill)",
    "• като пътища в лабиринт; 8 съседа; O(R·C)",
    "• сортиране чрез сливане по площ, O(k log k)",
    "**ЕМП – маршрут с батерия",
    "• най-близък съсед: 6–26 % над оптимума",
    "• генетичен алгоритъм: оптимум в 100/100 задачи (n ≤ 8), 11–26 % по-къс при n = 10–60",
], size=15)
picture(s, RES / "emp_vs_exact.png", Inches(6.7), Inches(1.35), Inches(6.3), Inches(2.6))
picture(s, RES / "asd_complexity.png", Inches(0.4), Inches(4.15), Inches(6.2), Inches(3.0))
picture(s, RES / "emp_large.png", Inches(6.7), Inches(4.15), Inches(6.2), Inches(3.0))

# 14. Изводи
s = new_slide("Изводи")
textbox(s, Inches(0.55), Inches(1.4), Inches(12.2), Inches(5.6), [
    "• [попълнете] По-добър модел по пълнота: …, пълнота … при прецизност …",
    "• [попълнете] Цената на пълнота ≥ 99 %: прецизността пада от … (праг 0.5) до …",
    "• Трансферното обучение достига висока точност с малко епохи; собственият CNN е по-малък",
    "• Изборът на праг по валидационното е по-важен от избора на модел за нашата цел",
    "• Конвейерът работи от край до край: снимка → карта → зони → маршрут",
    "**Следващи стъпки",
    "  – реални снимки от дрон; сегментация на пукнатините (U-Net) вместо класификация на плочки",
    "  – плочки с припокриване → по-точни граници на зоните",
], size=18)

# 15. Източници
s = new_slide("Източници")
textbox(s, Inches(0.55), Inches(1.4), Inches(12.2), Inches(5.6), [
    "1. Özgenel, Ç. F. (2019). Concrete Crack Images for Classification. Mendeley Data, V2. doi:10.17632/5y9wdsg2zt.2",
    "2. Özgenel, Ç. F., Gönenç Sorguç, A. (2018). Performance Comparison of Pretrained CNNs on Crack Detection in Buildings. ISARC.",
    "3. Zhang, L. et al. (2016). Road crack detection using deep convolutional neural network. IEEE ICIP.",
    "4. Sandler, M. et al. (2018). MobileNetV2: Inverted Residuals and Linear Bottlenecks. CVPR.",
    "5. Kingma, D. P., Ba, J. (2015). Adam: A Method for Stochastic Optimization. ICLR.",
    "6. Ioffe, S., Szegedy, C. (2015). Batch Normalization. ICML.",
    "7. Srivastava, N. et al. (2014). Dropout: A Simple Way to Prevent Neural Networks from Overfitting. JMLR.",
    "8. Prins, C. (2004). A simple and effective evolutionary algorithm for the VRP. Computers & OR.",
    "Код: github.com/<потребител>/nm-cnn-dron-<екип>",
], size=15)

prs.save(OUT)
print("Записано:", OUT)
