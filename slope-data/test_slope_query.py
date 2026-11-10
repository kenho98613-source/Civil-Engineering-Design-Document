"""Offline tests (no network): python -m unittest test_slope_query"""
import json, os, tempfile, unittest
import slope_query as sq


def sq_feat(no, x0, y0, w, h, **attrs):
    ring = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0]]
    a = {"SLOPE_NO": no, "LOCATION": "TEST", "CTL_CAT": "1", "MAINT_PART": "AIL260"}
    a.update(attrs)
    return {"attributes": a, "geometry": {"rings": [ring]}}


class T(unittest.TestCase):
    def setUp(self):
        self.calls = []
        feats = [
            sq_feat("11SW-D/C  67", 1010, 0, 10, 10, OVERALL_HT=8, OVERALL_AN=45),   # 10 m east
            sq_feat("11SW-D/FR 137", 1003, 0, 5, 5, WALL1_HT=7, WALL1_L=20, SLOPE1_HT=3),  # 3 m
            sq_feat("11SW-D/F  395", 990, 0, 20, 5, OVERALL_HT=3.5),  # overlaps
        ]
        def fake_post(url, params, timeout=60):
            self.calls.append(params)
            return {"features": feats}
        sq._post = fake_post
        self.tmp = tempfile.mkdtemp()

    def test_boundary(self):
        b = os.path.join(self.tmp, "b.csv")
        open(b, "w").write("E,N\n1000,0\n1000,10\n990,10\n990,0\n")
        rows = sq.main(["--boundary", b, "--radius", "50", "--out", self.tmp])
        r = [x["row"] for x in rows]
        self.assertEqual([x["Feature No."] for x in r], ["11SW-D/F 395", "11SW-D/FR 137", "11SW-D/C 67"])
        self.assertEqual(r[0]["Within / Outside site"], "Within / straddles site")
        self.assertEqual(r[1]["Min. distance to site (m)"], "3")
        self.assertIn("RW>6 m within 6 m", r[1]["Screening flag (proximity)"])
        self.assertEqual(r[1]["Max. Ht (m)"], "7")
        self.assertEqual(r[1]["Length (m)"], "20")
        self.assertEqual(r[2]["Min. distance to site (m)"], "10")
        self.assertEqual(r[2]["Screening flag (proximity)"], "")  # 10 m > 7.5 m
        self.assertEqual(self.calls[0]["geometryType"], "esriGeometryPolygon")
        self.assertEqual(self.calls[0]["distance"], 50.0)
        md = open(os.path.join(self.tmp, "registered_features.md"), encoding="utf-8").read()
        self.assertIn("Retrieved:", md)

    def test_point(self):
        rows = sq.main(["--e", "1000", "--n", "5", "--radius", "30", "--out", self.tmp])
        d = {x["row"]["Feature No."]: x["row"]["Min. distance to site (m)"] for x in rows}
        self.assertEqual(d["11SW-D/F 395"], "0")
        self.assertEqual(d["11SW-D/FR 137"], "3")

    def test_where(self):
        args = sq.build_where(type("A", (), {"slope_no": ["11SW-D/F 395"], "location": None, "where": None})())
        self.assertEqual(args, "(SLOPE_NO LIKE '11SW-D/F%395')")

    def test_type(self):
        self.assertEqual(sq.feature_type("11SW-D/FR 137")[0], "FR")


if __name__ == "__main__":
    unittest.main()
