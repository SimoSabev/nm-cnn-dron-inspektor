"""Демо данни за сайта: синтетична снимка на стена + вероятности ŷ, които дават
точно картата от демото на src/pipeline (20 × 30, seed 2).

ВАЖНО: това НЕ са резултати от невронната мрежа. Когато моделът е обучен,
запишете истинските ŷ с tools/export_cnn_probs (виж docs/web.md) и сайтът
ще ги покаже вместо тези. Пускане: python -m tools.make_demo_data

Demo data for the website: a synthetic wall photo and probabilities that
reproduce the demo crack map. NOT neural-network output.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from src.tiling import random_crack_mask

ROOT = Path(__file__).resolve().parents[1] / "web"
T = 40  # пиксела на плочка в демо снимката


def demo_probs(m: np.ndarray, seed: int = 7) -> np.ndarray:
    rng = np.random.default_rng(seed)
    R, C = m.shape
    p = rng.uniform(0.005, 0.06, (R, C))
    for i in range(R):
        for j in range(C):
            if m[i, j]:
                p[i, j] = rng.uniform(0.82, 0.995)
            elif m[max(0, i - 1):i + 2, max(0, j - 1):j + 2].sum():
                p[i, j] = rng.uniform(0.06, 0.28)   # съседи на пукнатина – мрежата се колебае
    for (i, j) in [(2, 15), (14, 28), (16, 7), (9, 13)]:
        if m[i, j]:
            p[i, j] = rng.uniform(0.38, 0.55)       # по-слаби пукнатини: изчезват при висок праг
    for (i, j), v in {(6, 24): 0.29, (6, 25): 0.24, (3, 26): 0.21, (15, 1): 0.27}.items():
        if not m[i, j]:
            p[i, j] = v                             # петна: близо до прага, но под него
    return p


def demo_wall(m: np.ndarray, seed: int = 7) -> Image.Image:
    rng = np.random.default_rng(seed)
    R, C = m.shape
    W, H = C * T, R * T
    base = rng.normal(150, 9, (H, W))
    low = Image.fromarray(rng.normal(0, 14, (H // 20, W // 20)).astype(np.float32)).resize((W, H), Image.BICUBIC)
    base += np.array(low)
    img = np.stack([base, base * 0.985, base * 0.95], -1).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(img).filter(ImageFilter.GaussianBlur(0.6))
    d = ImageDraw.Draw(im)
    for y in range(0, H, 200):
        d.line([(0, y), (W, y)], fill=(118, 116, 110), width=2)          # фуги на кофража
    for y in range(100, H, 200):
        for x in range(60, W, 240):
            d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(92, 90, 86))  # дупки от анкерите
    for (i, j) in [(6, 24), (6, 25), (15, 1)]:
        cx, cy = j * T + 20, i * T + 20
        d.ellipse([cx - 26, cy - 14, cx + 26, cy + 16], fill=(128, 124, 116))  # петна
    im = im.filter(ImageFilter.GaussianBlur(0.4))
    d = ImageDraw.Draw(im)
    cells = [(i, j) for i in range(R) for j in range(C) if m[i, j]]
    P = {(i, j): (j * T + 20 + rng.uniform(-6, 6), i * T + 20 + rng.uniform(-6, 6)) for (i, j) in cells}
    for (i, j) in cells:
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                if (di, dj) > (0, 0) and (i + di, j + dj) in P:
                    a, b = P[(i, j)], P[(i + di, j + dj)]
                    pts = [a] + [(a[0] + (b[0] - a[0]) * k / 5 + rng.uniform(-2.5, 2.5),
                                  a[1] + (b[1] - a[1]) * k / 5 + rng.uniform(-2.5, 2.5)) for k in range(1, 5)] + [b]
                    d.line(pts, fill=(38, 36, 34), width=int(rng.integers(2, 4)), joint="curve")
        ends = [(di, dj) for di in (-1, 0, 1) for dj in (-1, 0, 1) if (di, dj) != (0, 0) and (i + di, j + dj) in P]
        if len(ends) <= 1:
            a = P[(i, j)]
            dx, dy = (-ends[0][1], -ends[0][0]) if ends else (1, 0.3)
            d.line([a, (a[0] + dx * 14, a[1] + dy * 14)], fill=(50, 48, 45), width=2)
    return im


def main() -> None:
    m = random_crack_mask(20, 30, 9, max_len=7, seed=2)
    p = demo_probs(m)
    assert ((p >= 0.32) == (m == 1)).all()
    (ROOT / "data").mkdir(parents=True, exist_ok=True)
    (ROOT / "assets").mkdir(parents=True, exist_ok=True)
    data = {
        "source": "demo",  # "demo" | "cnn"
        "note": "Синтетична стена и вероятности за демонстрация; не са изход от невронната мрежа.",
        "rows": 20, "cols": 30, "tile_m": 0.5, "threshold": 0.32, "image": "assets/wall-demo.jpg",
        "probs": [[round(float(x), 3) for x in row] for row in p],
        # по-голяма стена за „гонката“ НС срещу ГА: 30 × 50 плочки, 19 зони
        "race_grid": random_crack_mask(30, 50, 26, max_len=7, seed=34).astype(int).tolist(),
    }
    (ROOT / "data" / "demo.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    demo_wall(m).save(ROOT / "assets" / "wall-demo.jpg", quality=86)
    print("Записано: web/data/demo.json, web/assets/wall-demo.jpg")


if __name__ == "__main__":
    main()
