# Данни

> Данните **не се качват** в хранилището (≈ 230 MB). Тук е откъде и как се изтеглят.

## Concrete Crack Images for Classification

| | |
|---|---|
| Автор | Çağlar Fırat Özgenel |
| Източник | Mendeley Data, версия 2 (23.07.2019) – https://data.mendeley.com/datasets/5y9wdsg2zt/2 |
| DOI | 10.17632/5y9wdsg2zt.2 |
| Съдържание | 40 000 RGB снимки 227 × 227: `Positive/` (пукнатина) 20 000, `Negative/` (без) 20 000 |
| Произход | 458 снимки 4032 × 3024 на бетонни сгради в кампуса на ODTÜ, нарязани по метода на Zhang et al. (2016) |
| Лиценз | **CC BY 4.0** – ⚠️ потвърдете на страницата на набора преди предаване |

### Цитиране (задължително)
```
Özgenel, Ç. F. (2019). Concrete Crack Images for Classification. Mendeley Data, V2. doi:10.17632/5y9wdsg2zt.2

Özgenel, Ç. F., Gönenç Sorguç, A. (2018). Performance Comparison of Pretrained Convolutional Neural Networks
on Crack Detection in Buildings. Proceedings of ISARC 2018, Berlin.
```

## Как се изтеглят

Тетрадката `notebooks/01_NM_CNN_pukmatini.ipynb` търси папка с `Positive/` и `Negative/` и опитва по ред:

1. **Официален източник (Mendeley)** – от страницата изтеглете архива (`.rar`), качете го в Google Drive и задайте пътя му в `ARCHIVE`. В Colab:
   ```python
   from google.colab import drive; drive.mount("/content/drive")
   ARCHIVE = "/content/drive/MyDrive/Concrete Crack Images for Classification.rar"
   ```
   Тетрадката го разархивира с `unrar` (наличен в Colab).
2. **Огледало в Kaggle** (същите 40 000 снимки): `arunrk7/surface-crack-detection` – изтегля се автоматично:
   ```python
   import kagglehub
   path = kagglehub.dataset_download("arunrk7/surface-crack-detection")
   ```
   Цитирайте оригиналния набор от Mendeley, не огледалото.
3. **Вече разархивирани** – сложете ги в `data/raw/` (локално) или `/content/data/` (Colab).

## Разделяне

Стратифицирано 70 / 15 / 15 % (обучаващо / валидационно / тестово), `seed = 42`. Точните списъци с файлове се записват в `results/split.json`.
Тестовото множество се използва **веднъж, накрая**; праг и настройки – само по валидационното.
