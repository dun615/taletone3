See README.md for which file to edit for each kind of change.

The site is the journey (a phone, a line, the record of every story) at the five chapter routes (`/`, `/about/`, `/approach/`, `/discography/`, `/contact/`, and the same under `/en/` and `/ja/`). It is built from `scripts/journey-page.mjs` (the document and its search tags come from `scripts/build.mjs`), `src/journey/journey.css` and `src/journey/journey.js`, reading `assets/data/site-content.json` (`journey` block) and `assets/data/works-data.json`.

- Never edit generated files (the route pages incl. `en/` and `ja/`, `preview/` (now redirects), `assets/journey/`, `sitemap.xml`); edit the sources above or the `.json` data, then run `npm run build`. Generated files are gitignored: commit sources only; `.github/workflows/deploy.yml` builds, validates and deploys to GitHub Pages on every push to `main` (live commit: `/version.txt`).
- Language lives in the URL: KR at `/`, EN at `/en/`, JP at `/ja/` (content keys stay `kr`/`en`/`jp`).
- Run `npm run check` before committing. CI and the deploy also run the headless-browser check (`.github/scripts/validate-runtime-performance.mjs`, needs `CHROME_PATH` locally): every route in every language on three screens, the whole story scrolled, a record played, an empty inquiry refused.
- Every work needs a stable lowercase `slug` (used for `?work=` links), three `vinyl` colours (taken from its cover) and existing files; the featured works are `pinned` 1, 2, 3. Works detail pages are retired: never generate per-work pages again.
- The journey's Korean font is LINE Seed KR (self-hosted subsets in assets/fonts, made by `scripts/subset-line-seed.py`; Japanese pages add LINE Seed JP).
- The earlier app (`src/app`, `src/page.html`, `src/styles`, React, `assets/js`) has been removed; news and RSS are retired. The five chapter routes in seo-content.json are the indexable navigation source.
- `npm install` is only needed for the optional tools in `scripts/optimize-assets.mjs` (sharp); build and checks have no dependencies.
