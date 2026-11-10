#!/usr/bin/env python3
"""
Query CEDD/GEO "Registered Man-made Slopes" (Catalogue of Slopes / SIS data)
near a site, and write tables ready for GAR Appendix B (registered features).

Data source: CEDD via CSDI Portal, ArcGIS REST FeatureServer (monthly update)
  https://portal.csdi.gov.hk/csdi-webpage/dataset/cedd_rcd_1636517655915_91216
Field definitions: https://ginfo.cedd.gov.hk/GEOOpenData/Data/Slope/Slope_Data_Dict.pdf

Standard library only (Python 3.8+). Works on Windows / Mac / Linux.

Examples
  # point + radius, HK1980 Grid
  python slope_query.py --e 834270 --n 812520 --radius 100 --out out_ykc
  # site boundary (CSV of E,N vertices, HK1980) + 50 m search buffer
  python slope_query.py --boundary site_boundary.csv --radius 50 --out out_ykc
  # point in WGS84
  python slope_query.py --lat 22.2486 --lon 114.1533 --radius 100
  # specific feature numbers
  python slope_query.py --slope-no "11SW-D/F395" "11SW-D/R6"
  # free text on LOCATION
  python slope_query.py --location "YUE KWONG"
"""
import argparse
import csv
import datetime as dt
import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request

SERVICE = ("https://portal.csdi.gov.hk/server/rest/services/common/"
           "cedd_rcd_1636517655915_91216/FeatureServer/0")
DATASET_PAGE = "https://portal.csdi.gov.hk/csdi-webpage/dataset/cedd_rcd_1636517655915_91216"
SOURCE_NAME = "CEDD Registered Man-made Slopes (Catalogue of Slopes), via CSDI Portal"
PAGE_SIZE = 2000  # server max is 3000

TYPE_NAMES = {
    "C": "Cut slope", "F": "Fill slope", "R": "Retaining wall",
    "CR": "Cut slope with retaining wall", "FR": "Fill slope with retaining wall",
    "D": "Disturbed terrain", "CF": "Cut and fill slope",
}

# Screening thresholds (engineer to confirm against current APP-25 / TGN wording)
SCREEN = dict(slope_angle=30.0, slope_ht=7.5, slope_dist=7.5,
              wall_ht=6.0, wall_dist=6.0, influence_factor=0.4)


# ---------------------------------------------------------------- HTTP
def _post(url, params, timeout=60):
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(url, data=data, headers={
        "User-Agent": "slope-query/1.0",
        "Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        js = json.loads(r.read().decode("utf-8"))
    if "error" in js:
        raise RuntimeError("Server error: %s" % json.dumps(js["error"]))
    return js


def query(where="1=1", geometry=None, geometry_type=None, in_sr=2326,
          distance=None, out_sr=2326):
    """Run an ArcGIS REST query with paging. Returns list of esri features."""
    feats, offset = [], 0
    while True:
        p = {"f": "json", "where": where, "outFields": "*",
             "returnGeometry": "true", "outSR": out_sr,
             "resultOffset": offset, "resultRecordCount": PAGE_SIZE}
        if geometry is not None:
            p.update(geometry=json.dumps(geometry), geometryType=geometry_type,
                     inSR=in_sr, spatialRel="esriSpatialRelIntersects")
            if distance:
                p.update(distance=distance, units="esriSRUnit_Meter")
        js = _post(SERVICE + "/query", p)
        batch = js.get("features", [])
        feats += batch
        if not js.get("exceededTransferLimit") or not batch:
            return feats
        offset += len(batch)


# ---------------------------------------------------------------- geometry
def _seg_dist(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _in_ring(p, ring):
    x, y = p; inside = False
    for i in range(len(ring) - 1):
        (x1, y1), (x2, y2) = ring[i], ring[i + 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def _in_poly(p, rings):
    # even-odd over all rings handles holes
    return sum(_in_ring(p, r) for r in rings) % 2 == 1


def _segs(rings):
    for r in rings:
        for i in range(len(r) - 1):
            yield r[i], r[i + 1]


def _seg_seg(a, b, c, d):
    def orient(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    o1, o2, o3, o4 = orient(a, b, c), orient(a, b, d), orient(c, d, a), orient(c, d, b)
    if (o1 > 0) != (o2 > 0) and (o3 > 0) != (o4 > 0):
        return 0.0
    return min(_seg_dist(c, a, b), _seg_dist(d, a, b), _seg_dist(a, c, d), _seg_dist(b, c, d))


def min_distance(site, feat_rings):
    """site: ('point',(x,y)) or ('poly',rings). Returns (dist_m, overlaps_site)."""
    if not feat_rings:
        return None, False
    kind, g = site
    if kind == "point":
        if _in_poly(g, feat_rings):
            return 0.0, True
        return min(_seg_dist(g, a, b) for a, b in _segs(feat_rings)), False
    # polygon site
    if any(_in_poly(v, g) for r in feat_rings for v in r) or \
       any(_in_poly(v, feat_rings) for r in g for v in r):
        return 0.0, True
    d = min(_seg_seg(a, b, c, e) for a, b in _segs(g) for c, e in _segs(feat_rings))
    return d, d == 0.0


class LocalMetres:
    """Equirectangular projection about a WGS84 origin (error << 1 m within 1 km)."""
    def __init__(self, lat0, lon0):
        self.lat0, self.lon0 = lat0, lon0
        self.kx = 111320.0 * math.cos(math.radians(lat0)); self.ky = 110574.0
    def __call__(self, pt):
        lon, lat = pt
        return ((lon - self.lon0) * self.kx, (lat - self.lat0) * self.ky)


# ---------------------------------------------------------------- attributes
def _num(v):
    try:
        return None if v is None or v == "" else float(v)
    except (TypeError, ValueError):
        return None


def _fmt(v, nd=1):
    return "" if v is None else ("%.*f" % (nd, v)).rstrip("0").rstrip(".")


def feature_type(slope_no):
    m = re.search(r"/\s*([A-Z]+)\s*\d", slope_no or "")
    code = m.group(1) if m else ""
    return code, TYPE_NAMES.get(code, code)


def summarise(attr):
    parts = lambda kind, key: [_num(attr.get("%s%d_%s" % (kind, i, key))) for i in (1, 2, 3)]
    s_ht, s_l, s_a = parts("SLOPE", "HT"), parts("SLOPE", "L"), parts("SLOPE", "ANG")
    w_ht, w_l, w_a = parts("WALL", "HT"), parts("WALL", "L"), parts("WALL", "ANG")
    mx = lambda xs: max([x for x in xs if x is not None], default=None)
    ht = _num(attr.get("OVERALL_HT"))
    ang = _num(attr.get("OVERALL_AN"))
    return dict(
        overall_ht=ht if ht else mx(s_ht + w_ht),
        overall_ang=ang if ang else mx(s_a + w_a),
        length=mx(s_l + w_l),
        slope_ht=mx(s_ht), slope_ang=mx(s_a), slope_len=mx(s_l),
        wall_ht=mx(w_ht), wall_ang=mx(w_a), wall_len=mx(w_l))


def screen_flags(code, s, dist):
    flags = []
    if dist is None:
        return flags
    has_slope = any(c in code for c in "CFD")
    has_wall = "R" in code
    if has_slope and (s["slope_ang"] or s["overall_ang"] or 0) > SCREEN["slope_angle"] \
            and (s["slope_ht"] or s["overall_ht"] or 0) > SCREEN["slope_ht"] \
            and dist <= SCREEN["slope_dist"]:
        flags.append("slope>%g deg & >%g m within %g m" % (
            SCREEN["slope_angle"], SCREEN["slope_ht"], SCREEN["slope_dist"]))
    if has_wall and (s["wall_ht"] or s["overall_ht"] or 0) > SCREEN["wall_ht"] \
            and dist <= SCREEN["wall_dist"]:
        flags.append("RW>%g m within %g m" % (SCREEN["wall_ht"], SCREEN["wall_dist"]))
    return flags


# ---------------------------------------------------------------- input helpers
def read_boundary(path):
    """CSV/TXT of x,y vertices (E,N in HK1980, or lon,lat) or a GeoJSON polygon."""
    if path.lower().endswith((".json", ".geojson")):
        js = json.load(open(path, encoding="utf-8"))
        geom = js
        if js.get("type") == "FeatureCollection":
            geom = js["features"][0]["geometry"]
        elif js.get("type") == "Feature":
            geom = js["geometry"]
        coords = geom["coordinates"] if geom["type"] == "Polygon" else geom["coordinates"][0]
        rings = [[tuple(map(float, p[:2])) for p in r] for r in coords]
    else:
        pts = []
        for row in csv.reader(open(path, encoding="utf-8-sig")):
            try:
                pts.append((float(row[0]), float(row[1])))
            except (ValueError, IndexError):
                continue  # header / blank
        rings = [pts]
    for r in rings:
        if r[0] != r[-1]:
            r.append(r[0])
    return rings


def build_where(args):
    clauses = []
    if args.slope_no:
        ors = []
        for s in args.slope_no:
            s = re.sub(r"\s+", "", s.upper())
            m = re.match(r"^(.*?/[A-Z]+)(\d+)$", s)
            pat = (m.group(1) + "%" + m.group(2)) if m else s
            ors.append("SLOPE_NO LIKE '%s'" % pat.replace("'", "''"))
        clauses.append("(" + " OR ".join(ors) + ")")
    if args.location:
        clauses.append("UPPER(LOCATION) LIKE '%%%s%%'" % args.location.upper().replace("'", "''"))
    if args.where:
        clauses.append("(%s)" % args.where)
    return " AND ".join(clauses) or "1=1"


# ---------------------------------------------------------------- main
COLS = ["No.", "Feature No.", "Type", "Location", "CTL Cat.",
        "Max. Ht (m)", "Length (m)", "Angle (deg)",
        "Maintenance party (SIS)", "Maintenance party (SMRIS, LandsD)",
        "Min. distance to site (m)", "Within / Outside site",
        "Screening flag (proximity)", "Influence zone (dist < %g H)" % SCREEN["influence_factor"],
        "Proposed works (retained / modified / removed & deregistered)",
        "CTL Cat. after development"]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_argument_group("site")
    g.add_argument("--e", type=float, help="site Easting, HK1980 Grid")
    g.add_argument("--n", type=float, help="site Northing, HK1980 Grid")
    g.add_argument("--lat", type=float, help="site latitude, WGS84")
    g.add_argument("--lon", type=float, help="site longitude, WGS84")
    g.add_argument("--boundary", help="site boundary: CSV of E,N (HK1980) vertices, or GeoJSON")
    g.add_argument("--boundary-wgs84", action="store_true", help="boundary file is lon,lat")
    ap.add_argument("--radius", type=float, default=100.0, help="search buffer from site (m), default 100")
    ap.add_argument("--slope-no", nargs="+", help="feature numbers, e.g. 11SW-D/F395")
    ap.add_argument("--location", help="text search in LOCATION field")
    ap.add_argument("--where", help="extra SQL where clause (advanced)")
    ap.add_argument("--site-name", default="", help="title used in the Markdown header")
    ap.add_argument("--out", default="slope_output", help="output folder")
    args = ap.parse_args(argv)

    where = build_where(args)
    site = None
    to_m = None  # converts returned coords to metres for distance calcs

    if args.boundary:
        rings = read_boundary(args.boundary)
        if args.boundary_wgs84:
            lon0, lat0 = rings[0][0]
            to_m = LocalMetres(lat0, lon0)
            esri = {"rings": [[list(p) for p in r] for r in rings], "spatialReference": {"wkid": 4326}}
            feats = query(where, esri, "esriGeometryPolygon", 4326, args.radius, out_sr=4326)
            site = ("poly", [[to_m(p) for p in r] for r in rings])
        else:
            esri = {"rings": [[list(p) for p in r] for r in rings], "spatialReference": {"wkid": 2326}}
            feats = query(where, esri, "esriGeometryPolygon", 2326, args.radius)
            site = ("poly", rings)
        site_desc = "site boundary (%d vertices) + %g m buffer" % (len(rings[0]) - 1, args.radius)
    elif args.e is not None and args.n is not None:
        pt = {"x": args.e, "y": args.n, "spatialReference": {"wkid": 2326}}
        feats = query(where, pt, "esriGeometryPoint", 2326, args.radius)
        site = ("point", (args.e, args.n))
        site_desc = "within %g m of E%.0f N%.0f (HK1980 Grid)" % (args.radius, args.e, args.n)
    elif args.lat is not None and args.lon is not None:
        pt = {"x": args.lon, "y": args.lat, "spatialReference": {"wkid": 4326}}
        feats = query(where, pt, "esriGeometryPoint", 4326, args.radius, out_sr=4326)
        to_m = LocalMetres(args.lat, args.lon)
        site = ("point", (0.0, 0.0))
        site_desc = "within %g m of %.6f N, %.6f E (WGS84)" % (args.radius, args.lat, args.lon)
    elif where != "1=1":
        feats = query(where)
        site_desc = "attribute query: %s" % where
    else:
        ap.error("give a site (--e/--n, --lat/--lon or --boundary) or --slope-no / --location")

    rows = []
    for f in feats:
        a = f.get("attributes", {})
        rings = (f.get("geometry") or {}).get("rings") or []
        if to_m:
            rings = [[to_m(p) for p in r] for r in rings]
        else:
            rings = [[tuple(p[:2]) for p in r] for r in rings]
        dist, overlap = min_distance(site, rings) if site else (None, False)
        code, tname = feature_type(a.get("SLOPE_NO"))
        s = summarise(a)
        flags = screen_flags(code, s, dist)
        ht = s["overall_ht"]
        infl = ""
        if dist is not None and ht and not overlap:
            infl = "Y" if dist < SCREEN["influence_factor"] * ht else ""
        if site is None:
            within = ""
        elif site[0] == "poly":
            within = "Within / straddles site" if overlap else "Outside site"
        else:
            within = "Covers site point" if overlap else ""
        rows.append(dict(
            attrs=a, geometry=f.get("geometry"), dist=dist,
            row={
                "Feature No.": re.sub(r"\s+", " ", (a.get("SLOPE_NO") or "").strip()),
                "Type": "%s (%s)" % (code, tname) if code else "",
                "Location": (a.get("LOCATION") or "").strip(),
                "CTL Cat.": a.get("CTL_CAT") or "",
                "Max. Ht (m)": _fmt(ht),
                "Length (m)": _fmt(s["length"]),
                "Angle (deg)": _fmt(s["overall_ang"], 0),
                "Maintenance party (SIS)": (a.get("MAINT_PART") or "").strip(),
                "Maintenance party (SMRIS, LandsD)": "",
                "Min. distance to site (m)": _fmt(dist),
                "Within / Outside site": within,
                "Screening flag (proximity)": "; ".join(flags),
                COLS[13]: infl,
                COLS[14]: "", COLS[15]: "",
            }))
    rows.sort(key=lambda r: (r["dist"] if r["dist"] is not None else 1e9, r["row"]["Feature No."]))
    for i, r in enumerate(rows, 1):
        r["row"]["No."] = i

    write_outputs(args, rows, site_desc)
    return rows


def write_outputs(args, rows, site_desc):
    os.makedirs(args.out, exist_ok=True)
    today = dt.date.today().isoformat()
    # CSV (utf-8-sig so Excel opens it cleanly)
    with open(os.path.join(args.out, "registered_features.csv"), "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=COLS); w.writeheader()
        for r in rows:
            w.writerow(r["row"])
    # full raw attributes
    with open(os.path.join(args.out, "registered_features_raw.csv"), "w", newline="", encoding="utf-8-sig") as fh:
        keys = sorted({k for r in rows for k in r["attrs"]})
        w = csv.DictWriter(fh, fieldnames=["min_dist_m"] + keys); w.writeheader()
        for r in rows:
            w.writerow(dict(r["attrs"], min_dist_m=_fmt(r["dist"], 2)))
    # GeoJSON (coords as returned: HK1980 Grid, or WGS84 when --lat/--lon used)
    gj = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": dict(r["attrs"], min_dist_m=r["dist"]),
         "geometry": {"type": "Polygon", "coordinates": (r["geometry"] or {}).get("rings", [])}}
        for r in rows]}
    with open(os.path.join(args.out, "registered_features.geojson"), "w", encoding="utf-8") as fh:
        json.dump(gj, fh)
    # Markdown for GAR App B
    md = []
    md.append("# Registered geotechnical features%s" % (" - " + args.site_name if args.site_name else ""))
    md.append("")
    md.append("- Source: %s (%s), dataset updated monthly by CEDD." % (SOURCE_NAME, DATASET_PAGE))
    md.append("- Retrieved: %s" % today)
    md.append("- Search: %s. %d features found, ordered by distance to site." % (site_desc, len(rows)))
    md.append("- Maintenance party (SIS) is the MAINT_PART field of the CEDD dataset. "
              "Check against SMRIS (LandsD, https://www.slope.landsd.gov.hk/smris/) and fill the SMRIS column; "
              "record any difference.")
    md.append("- Screening flag uses: slopes > %g deg and > %g m high within %g m; retaining walls > %g m high "
              "within %g m. Influence zone flag: distance < %g x feature height. Thresholds are for screening "
              "only and should be confirmed by the engineer."
              % (SCREEN["slope_angle"], SCREEN["slope_ht"], SCREEN["slope_dist"], SCREEN["wall_ht"],
                 SCREEN["wall_dist"], SCREEN["influence_factor"]))
    md.append("- Unregistered features are not in this dataset. Identify them by site walkover and aerial "
              "photograph interpretation, and check for any SIMAR records.")
    md.append("- Height / length / angle: overall values where given, otherwise the maximum of the slope / wall part values.")
    md.append("")
    md.append("| " + " | ".join(COLS) + " |")
    md.append("|" + "---|" * len(COLS))
    for r in rows:
        md.append("| " + " | ".join(str(r["row"][c]).replace("|", "/") for c in COLS) + " |")
    with open(os.path.join(args.out, "registered_features.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(md) + "\n")
    print("%d features -> %s" % (len(rows), os.path.abspath(args.out)))
    for r in rows:
        x = r["row"]
        print("  %-16s %-4s CTL%-2s H=%-5s d=%-6s %s" % (
            x["Feature No."], x["Type"].split(" ")[0], x["CTL Cat."], x["Max. Ht (m)"],
            x["Min. distance to site (m)"], x["Maintenance party (SIS)"]))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # keep message short for non-programmers
        sys.exit("Error: %s" % e)
