# Сайтът (`web/`)

Статичен сайт: HTML + CSS + JavaScript модули, без сборка, без сървър и без зависимости. Всичко се смята в браузъра. Хостингът е безплатен (GitHub Pages или Cloudflare Pages).

*English: a static site with no build step and no dependencies; everything runs in the browser. Run it with any static file server; deploy the `web/` folder.*

## Пускане локално

```bash
python -m http.server 8000 -d web      # после http://localhost:8000
```

Трябва сървър (не двоен клик върху файла), защото страниците зареждат `data/demo.json` и JavaScript модули.

## Тестове

```bash
python -m pytest -q                          # Python: src/ и ултразвук
python -m tools.make_golden                  # еталони от src/ за JS (при промяна в src/)
node --test web/tests/parity.test.mjs        # JS ядрото дава същото като Python
```

GitHub Actions (`.github/workflows/ci.yml`) пуска и трите при всеки push и pull request и проверява, че `golden.json` е актуален.

## Публикуване

**GitHub Pages (препоръчително, нищо допълнително):** *Settings → Pages → Build and deployment → Source: GitHub Actions*. След това всеки push в `main` публикува `web/` чрез `.github/workflows/pages.yml`. Адресът е `https://<потребител>.github.io/nm-cnn-dron-inspektor/`.

**Cloudflare Pages (алтернатива):** *Workers & Pages → Create → Pages → Connect to Git*, избирате хранилището; *Build command*: празно; *Build output directory*: `web`.

## Файлове

| Файл | Какво е |
|---|---|
| `index.html` … `how.html` | 7 страници; всяка зарежда `js/pages/<име>.js` |
| `css/app.css` | общ стил (цветове: оранжево = дефект, синьо = дрон и маршрут) |
| `js/core.js` | алгоритмите от `src/`: `findZones`, `sortZonesByArea`, `zonesToProblem` (+ резерв), `nearestNeighbor`, `splitTour`, `geneticAlgorithm`, `exactSolution` |
| `js/ultrasound.js` | формулите от `src/ultrasound.py` |
| `js/sim.js` | симулатор на мисията за „Мониторинг“ |
| `js/strings.js` | **всички текстове** като `ключ: [български, английски]` |
| `js/i18n.js`, `js/ui.js` | език, общи помощни функции |
| `data/demo.json` | демо данни (от `python -m tools.make_demo_data`) |
| `how.html` | генерира се от `python -m tools.make_scheme` (не се редактира на ръка) |

**Превод:** нов текст = нов ред в `strings.js` с двата езика. Езикът се избира с BG/EN горе вдясно или с `?lang=en`.

## Формат на данните: как истинските ŷ влизат в сайта

`web/data/demo.json`:

```json
{
  "source": "cnn",
  "rows": 20, "cols": 30, "tile_m": 0.5, "threshold": 0.32,
  "image": "assets/wall.jpg",
  "probs": [[0.02, 0.91, ...], ...],
  "race_grid": [[0, 1, ...], ...]
}
```

`probs` е R × C, ред 0 е най-горният (както в `src/tiling.py`). `image` е снимката на стената, изрязана точно до решетката.

> ⚠️ **Условието (§6.3): данните не се качват в хранилището.** Стена, сглобена от плочки на Concrete Crack Images (`tiling.assemble_wall`), е изградена от набора, затова такава снимка **не** се записва в `web/assets/`. В `image` слагайте само **собствена** снимка (например от ръчната стойка) или оставете синтетичната демо стена. Вероятностите `probs` са изход на модела, не данни от набора, и могат да се качат. `race_grid` е по желание (без него гонката не се показва). При `"source": "cnn"` значката „ДЕМО ДАННИ“ става „РЕЗУЛТАТ ОТ CNN“.

Клетка за тетрадката по НМ, след като имате `model`, `tiles`, `shape = (R, C)`, `threshold` и **собствена** снимка на стената `wall_rgb` (H × W × 3):

```python
import json, numpy as np
from PIL import Image
probs = model.predict(tiles, verbose=0).ravel().reshape(shape)
R, C = shape
Image.fromarray(wall_rgb).resize((C * 40, R * 40)).save("web/assets/wall.jpg", quality=86)
json.dump({"source": "cnn", "rows": R, "cols": C, "tile_m": 0.5, "threshold": float(threshold),
           "image": "assets/wall.jpg", "probs": np.round(probs, 3).tolist()},
          open("web/data/demo.json", "w"), ensure_ascii=False)
```

## Истинска телеметрия (за когато има дрон)

„Мониторинг“ чете състоянието от `Mission.telemetry()` в `js/sim.js`. Истинският източник трябва да дава същите полета, например като JSON по WebSocket от малък мост (Raspberry Pi: pymavlink → WebSocket):

```json
{ "phase": "scan", "time": 104.2, "batt": 82.1, "battName": 1,
  "pos": [5.25, 2.75], "alt": 2.75, "speed": 0.5,
  "rangeRaw": 3.02, "rangeFiltered": 3.00, "canShoot": true, "correction": 0,
  "link": 93, "gps": 15, "current": [14, 10] }
```

`phase`: `scan` · `home` · `analysis` · `reflight` · `done` · `aborted`. `pos` е в метри от долния ляв ъгъл на стената. Мостът още не е написан: това е задача за след презентацията.
