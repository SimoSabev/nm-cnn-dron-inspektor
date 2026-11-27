"""Връзката снимка <-> плочки <-> карта 0/1 (между НМ и АСД).

* slice_into_tiles  – голяма снимка на стена -> плочки 227x227 + размер на решетката;
* probs_to_map      – вероятностите от CNN -> карта 0/1 по избран праг;
* random_crack_mask – случайни "пукнатини" (за демонстрация и тестове);
* assemble_wall     – сглобява "стена" от отделни плочки по маска 0/1 –
                      така получаваме снимка с ИЗВЕСТНА вярна карта и можем да
                      измерим грешката на целия конвейер.
"""

from __future__ import annotations

import random
from typing import List, Sequence, Tuple

import numpy as np

TILE = 227  # размерът на снимките в набора Concrete Crack Images


def slice_into_tiles(image: np.ndarray, tile: int = TILE) -> Tuple[np.ndarray, Tuple[int, int]]:
    """Нарязва изображение H x W x 3 на плочки tile x tile.

    Ако H или W не се делят на tile, краят се допълва огледално (reflect),
    за да не се изгуби пукнатина в последния ред/колона.
    Връща (tiles с форма (R·C, tile, tile, 3), (R, C)); плочките са по редове.
    """
    if image.ndim != 3:
        raise ValueError("Очаква се изображение H x W x канали")
    h, w = image.shape[:2]
    rows, cols = -(-h // tile), -(-w // tile)  # таван на делението
    pad_h, pad_w = rows * tile - h, cols * tile - w
    if pad_h or pad_w:
        mode = "reflect" if (pad_h < h and pad_w < w) else "edge"
        image = np.pad(image, ((0, pad_h), (0, pad_w), (0, 0)), mode=mode)
    tiles = (
        image.reshape(rows, tile, cols, tile, image.shape[2])
        .swapaxes(1, 2)
        .reshape(rows * cols, tile, tile, image.shape[2])
    )
    return tiles, (rows, cols)


def probs_to_map(probs: Sequence[float], shape: Tuple[int, int], threshold: float = 0.5) -> np.ndarray:
    """Вероятност за пукнатина за всяка плочка -> карта 0/1 (R x C).

    Прагът се избира по ВАЛИДАЦИОННОТО множество (тетрадка НМ) така, че
    пълнотата да е висока – пропусната пукнатина е по-скъпа от излишна проверка.
    """
    p = np.asarray(probs, dtype=float).reshape(shape)
    return (p >= threshold).astype(np.int8)


def random_crack_mask(rows: int, cols: int, n_cracks: int = 5, max_len: int = 12,
                      seed: int = 0) -> np.ndarray:
    """Случайни пукнатини като "разходки" по решетката (предимно в една посока,
    с отклонения – както истинските пукнатини)."""
    rng = random.Random(seed)
    mask = np.zeros((rows, cols), dtype=np.int8)
    directions = [(0, 1), (1, 0), (1, 1), (-1, 1)]
    for _ in range(n_cracks):
        r, c = rng.randrange(rows), rng.randrange(cols)
        dr, dc = rng.choice(directions)
        for _ in range(rng.randint(2, max_len)):
            mask[r, c] = 1
            if rng.random() < 0.3:  # отклонение встрани
                dr, dc = rng.choice(directions)
            r = min(max(r + dr, 0), rows - 1)
            c = min(max(c + dc, 0), cols - 1)
    return mask


def assemble_wall(mask: np.ndarray, positive: Sequence[np.ndarray],
                  negative: Sequence[np.ndarray], seed: int = 0) -> np.ndarray:
    """Сглобява снимка на стена: плочка с пукнатина там, където mask == 1.

    positive / negative – списъци от изображения tile x tile x 3 (напр. от
    ТЕСТОВОТО множество, за да не "видим" обучаващите данни).
    """
    rng = random.Random(seed)
    rows, cols = mask.shape
    tile = positive[0].shape[0]
    wall = np.zeros((rows * tile, cols * tile, positive[0].shape[2]), dtype=positive[0].dtype)
    for r in range(rows):
        for c in range(cols):
            src = positive if mask[r, c] else negative
            wall[r * tile:(r + 1) * tile, c * tile:(c + 1) * tile] = src[rng.randrange(len(src))]
    return wall


def map_errors(pred: np.ndarray, truth: np.ndarray) -> dict:
    """Сравнение на предсказаната и вярната карта по плочки."""
    tp = int(((pred == 1) & (truth == 1)).sum())
    fp = int(((pred == 1) & (truth == 0)).sum())
    fn = int(((pred == 0) & (truth == 1)).sum())
    tn = int(((pred == 0) & (truth == 0)).sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"TP": tp, "FP": fp, "FN": fn, "TN": tn,
            "прецизност": precision, "пълнота": recall, "F1": f1}


def tiles_from_list(images: List[np.ndarray]) -> np.ndarray:
    return np.stack(images, axis=0)
