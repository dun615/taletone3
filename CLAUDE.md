See README.md for which file to edit for each kind of change.

- Never edit generated files (the 18 route pages incl. `en/` and `ja/`, `works/<slug>/` and `news/<slug>/` detail pages, `preview/`, `assets/app/app.js`, `assets/data/*-content.js`, `sitemap.xml`); edit `src/page.html`, `src/app/*` (component core + `src/app/parts/*.js`) or the `.json` sources, then run `npm run build`. Generated files are gitignored: commit sources only; `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main` (live commit: `/version.txt`).
- Language lives in the URL: KR at `/`, EN at `/en/`, JP at `/ja/` (content keys stay `kr`/`en`/`jp`).
- Run `npm run check` before committing. CI (`.github/workflows/site-validation.yml`) runs the same checks plus a headless-browser runtime check (`.github/scripts/validate-runtime-performance.mjs`, needs `CHROME_PATH` locally).
- Some assertions in `.github/scripts/validate-site.mjs` still match exact code strings; if a deliberate change trips one, update the assertion in the same commit. Prefer behaviour checks in the runtime validator for new rules.
- Every work (`assets/data/works-data.json`) and news item (`site-content.json` → `news`) needs a stable lowercase `slug`; the build fails without one.
- Korean text uses Nanum Gothic via the `--tt-noto-primary` CSS variable (JP pages swap in Noto Sans JP); don't add other Korean font names to font stacks.
- `npm install` is only needed for the optional tools in `scripts/optimize-assets.mjs` (sharp); build and checks have no dependencies.

Styles: edit src/styles/site-and-dialogs.css and src/styles/discography.css. assets/css/works.css is generated. Preview shares live sources; do not recreate duplicate preview-src code. The News index uses the existing static detail-page layout.
