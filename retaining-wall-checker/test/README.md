# Regression harness

Run before and after every model change. Needs Node + Playwright (Chromium) and Python 3.

```
node test/vreg.js <old.html> old.json <project.rwall>
node test/vreg.js src/index.html new.json <project.rwall>
python3 test/cmp.py old.json new.json [case-name-filter]
node test/ui2.js src/index.html <project.rwall>
node test/pdf.js src/index.html <project.rwall> <wall type index> out.pdf [full]
```

- `vreg.js`: 36 cases (default T / L / Li / G walls with Global and Partial factor, Ka mode variants, every wall type of the project file with variants: manual Ka 0.25, Coulomb, Partial factor, passive on, toe soil / d_p, accidental impact), the multi-wall-type summary page and the 5 built-in benchmarks.
- `cmp.py`: numeric results must be **SAME** for every case; changed report HTML is listed for review.
- `ui2.js`: real clicks on stem on base, drag handles, Auto-bar, Auto design, Setup wizard, wall type switch and export. Must show 0 page errors.

Project `.rwall` files and result `.json` / `.pdf` files contain client project data: keep them out of this public repository.
