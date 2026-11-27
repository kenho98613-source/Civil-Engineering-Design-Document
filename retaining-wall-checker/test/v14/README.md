# v14 build and tests

Build from v13.8.13 (`base.html` = previous `src/index.html`):

    python3 mktpl2.py                    # DXF template (tpl.dxf -> tpl2.js): text style S2 romans.shx, dimstyles 1-20/25/50/100
    python3 p14_1.py base.html t1.html   # CR-1 DXF section export (dxf_code.js + tpl2.js)
    python3 p14_4.py t1.html t2.html     # CR-4 bearing near slope crest (GG1 Fig. A4 / FC 2017 Fig. 2.3)
    python3 p14_3.py t2.html v14.html    # CR-3 BMD/SFD, curtailment, lap length (dg_code.js)

v14.0.0: CR-1, CR-3, CR-4. v14.0.1: DXF annotation (real DIMENSION + dimstyle 1-<scale>, text S2 2 mm x scale, level mark label/value/triangle).

Tests (project .rwall files are not in this repo – pass your own):
- `../vreg.js` + `../cmp.py` regression; `dxftest.js` + `dxcheck.py` DXF export + ezdxf audit (`SC=50` for 1:50); `rend.py` PNG render;
  `crtest.js` crest bearing; `dgtest.js`, `cutest.js` diagrams / curtailment; `ui14.js` UI clicks.

Result 2026-11-27: numeric 36/36 same as v13.8.13, benchmarks 5/5, DXF 12/12 audit 0 errors (1:100, 1:50), PDF print 0 errors.
