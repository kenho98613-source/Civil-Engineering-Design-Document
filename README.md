# Civil Engineering Design Document

| Tool | Folder |
|---|---|
| Retaining Wall Design & Checker v9.0 (HK GEO / BD codes) | [`retaining-wall-checker/`](retaining-wall-checker/) |

## Gemini independent checker
`.github/workflows/gemini-bd-geo-checker.yml` runs on every PR that changes `retaining-wall-checker/src/**`. It sends the changed calc files to Gemini with the BD & GEO checker prompt in `.github/gemini/bd-geo-checker-prompt.md` (GG1, FC2017, CoP SUC 2013; no BS-code methods) and posts the result as a PR review comment.

Setup: add repo secret `GEMINI_API_KEY` (Settings → Secrets and variables → Actions). Optional repo variable `GEMINI_MODEL` (default `gemini-3.1-pro-preview`).
