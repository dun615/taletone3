See README.md for which file to edit for each kind of change.

- Never edit generated files (the 18 route pages incl. `en/` and `ja/`, `assets/data/*-content.js`, `sitemap.xml`); edit `src/page.html`, `src/app/*` or the `.json` sources, then run `npm run build`.
- Language lives in the URL: KR at `/`, EN at `/en/`, JP at `/ja/` (content keys stay `kr`/`en`/`jp`).
- Run `npm run check` before committing. CI (`.github/workflows/site-validation.yml`) runs the same checks plus a headless-browser runtime check (`.github/scripts/validate-runtime-performance.mjs`, needs `CHROME_PATH` locally).
- Many assertions in `.github/scripts/validate-site.mjs` match exact code strings; if a deliberate change trips one, update the assertion in the same commit.
