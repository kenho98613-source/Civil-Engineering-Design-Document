# Retaining Wall Design & Checker – desktop app

Tauri 2 wrapper around `src/index.html` (the same single-file v9.6 tool). All calculations run in the page; the Rust side only opens / saves `.rwall` project files.

## Build
Push to `main` (or run the workflow manually). GitHub Actions builds on `windows-latest` and uploads:
- `retaining-wall-checker.exe` – portable, no install (needs WebView2, built into Windows 10/11)
- `*-setup.exe` (NSIS, per-user install) and `.msi`, both register the `.rwall` file type

Local build (Windows): install Rust + Node 20, then `npm install && npm run icons && npm run build`.

## Updating the tool
Replace `src/index.html` with the new HTML version and push.

Unsigned builds show a SmartScreen warning on first run: More info → Run anyway.
