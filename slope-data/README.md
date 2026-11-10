# Slope data query (SIS / Catalogue of Slopes)

`slope_query.py` pulls registered man-made slopes and retaining walls near a site from the CEDD open dataset
**Registered Man-made Slopes** (CSDI Portal, ArcGIS REST, updated monthly) and writes tables for GAR Appendix B.

- Dataset: https://portal.csdi.gov.hk/csdi-webpage/dataset/cedd_rcd_1636517655915_91216
- Endpoint: `https://portal.csdi.gov.hk/server/rest/services/common/cedd_rcd_1636517655915_91216/FeatureServer/0/query`
- Field list: https://ginfo.cedd.gov.hk/GEOOpenData/Data/Slope/Slope_Data_Dict.pdf
- No API key. Python 3.8+ standard library only (no `pip install`).

## Run

```
python slope_query.py --e 834250 --n 812520 --radius 100 --site-name "CS2142 YKC" --out out_ykc
python slope_query.py --boundary site_boundary.csv --radius 50 --site-name "CS2142 YKC" --out out_ykc
python slope_query.py --lat 22.2486 --lon 114.1533 --radius 100
python slope_query.py --slope-no "11SW-D/F395" "11SW-D/R6"
python slope_query.py --location "YUE KWONG"
```

`site_boundary.csv`: one vertex per line, `E,N` in HK1980 Grid (a header line is fine). GeoJSON polygons also work.
Add `--boundary-wgs84` if the file is `lon,lat`.

## Output (in `--out` folder)

| File | Use |
|---|---|
| `registered_features.md` | App B / Table 2.x, with source and retrieval date in the header |
| `registered_features.csv` | Same table for Excel |
| `registered_features_raw.csv` | Every field from the dataset + min. distance |
| `registered_features.geojson` | Feature polygons (HK1980 Grid; WGS84 if `--lat/--lon` used), opens in QGIS |

Rows are ordered by minimum distance from the site (point or boundary) to the feature polygon.
Blank columns are for the engineer: SMRIS (LandsD) maintenance party, proposed works, CTL after development.

## Limits

- Maintenance party is the CEDD `MAINT_PART` field. SMRIS (LandsD) has no public API, so check it at
  https://www.slope.landsd.gov.hk/smris/ and fill the SMRIS column.
- Unregistered features are not in the dataset: walkover / API interpretation / SIMAR.
- Screening and influence-zone flags use thresholds in `SCREEN` at the top of the script; confirm them per job.

## Test

`python -m unittest test_slope_query` (offline, no network).
