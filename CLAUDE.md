See README.md for which file to edit for each kind of change.

- Never edit the base64 blocks in the route pages or `assets/data/*-content.js`; edit `src/app/*` or the `.json` sources, then run `npm run build`.
- Run `npm run check` before committing. CI (`.github/workflows/site-validation.yml`) runs the same checks plus a headless-browser runtime check (`.github/scripts/validate-runtime-performance.mjs`, needs `CHROME_PATH` locally).
- Many assertions in `.github/scripts/validate-site.mjs` match exact code strings; if a deliberate change trips one, update the assertion in the same commit.
