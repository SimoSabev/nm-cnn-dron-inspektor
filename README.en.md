# Drone inspector for buildings

*Bulgarian (main): [README.md](README.md)*

Interdisciplinary school team project, unit III "Convolutional networks", topic 2. Three subjects: Neural Networks (НМ), Algorithms and Data Structures (АСД), Heuristic Methods (ЕМП). Class XII В.

A drone photographs a wall → the photo is cut into tiles → a **CNN** finds the tiles with cracks → **recursive flood fill** groups them into damaged zones → a **heuristic** plans a re-flight over those zones only, within the battery limit → an engineer measures crack depth on site with **ultrasound**.

## Pipeline

```
photo ─► [NN] CNN: P(crack) for every 227×227 tile ─► 0/1 map (R × C)
      ─► [ALGO] recursive flood fill → connected zones → merge sort by area
      ─► [HEUR] route through zone centres with a battery: nearest neighbour vs genetic algorithm
               (checked against the exact solution for ≤ 8 zones)
      ─► re-flight plan ─► on-site ultrasonic check of crack depth
```

Architecture, module contracts and diagrams: [docs/arhitektura.md](docs/arhitektura.md) (Bulgarian). Concept, drone proposal, law and the plan until the defence: [docs/concept.en.md](docs/concept.en.md).

## Parts

| Subject | Where | What |
|---|---|---|
| NN | `notebooks/01_NM_CNN_pukmatini.ipynb`, `src/tiling.py` | own CNN vs MobileNetV2 (transfer learning), threshold for recall ≥ 99 %, confusion matrix, F1 |
| ALGO | `notebooks/02_ASD_zoni_s_pukmatini.ipynb`, `src/grid_zones.py` | recursive grid traversal, merge sort, O(R·C) and O(k log k), tests |
| HEUR | `notebooks/03_EMP_marshrut_na_drona.ipynb`, `src/route_planning.py` | nearest neighbour vs genetic algorithm vs exact solution |
| Ultrasound | `src/ultrasound.py` | rangefinder (steady 3 m, tile size from distance); on-site UPV crack depth (BS 1881-203) and concrete grade (IS 13311-1) |
| Website | `web/` | bilingual BG/EN static site: mission monitor, analysis, route, on-site check, sandbox, "How it works" |

## Quick start

```bash
pip install numpy matplotlib pytest pillow    # tensorflow only for the NN notebook
python -m pytest -q                            # all Python tests
python -m src.pipeline                         # demo: map → zones → routes → results/pipeline_demo.png
python -m http.server 8000 -d web              # website at http://localhost:8000
node --test web/tests/parity.test.mjs          # the website's JS gives the same results as src/
```

The NN notebook is meant for Google Colab with a T4 GPU (see the Bulgarian README).

## Data

**Concrete Crack Images for Classification**: 40 000 images 227 × 227, 2 classes. Özgenel, Ç. F. (2019), Mendeley Data, V2, DOI [10.17632/5y9wdsg2zt.2](https://doi.org/10.17632/5y9wdsg2zt.2), CC BY 4.0. Details: [data/README.md](data/README.md). The demo wall on the website is synthetic.

## Sources

1. Özgenel, Ç. F. (2019). *Concrete Crack Images for Classification*. Mendeley Data, V2.
2. Özgenel, Ç. F., Gönenç Sorguç, A. (2018). *Performance Comparison of Pretrained CNNs on Crack Detection in Buildings*. ISARC 2018.
3. Sandler, M. et al. (2018). *MobileNetV2: Inverted Residuals and Linear Bottlenecks*. CVPR.
4. Prins, C. (2004). *A simple and effective evolutionary algorithm for the vehicle routing problem*. Computers & Operations Research 31.
5. Kingma, D. P., Ba, J. (2015). *Adam: A Method for Stochastic Optimization*. ICLR.
6. BS 1881-203. *Recommendations for measurement of velocity of ultrasonic pulses in concrete* (crack depth by the Tc–Ts method).
7. IS 13311 (Part 1): 1992. *Non-destructive testing of concrete: ultrasonic pulse velocity* (quality grading by velocity).
8. Regulation (EU) 2019/947 on the rules and procedures for the operation of unmanned aircraft.
