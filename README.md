# TALETONE MUSIC

GitHub Pages static site: https://taletone.net

## Current chapters

| Chapter | Korean URL | English / Japanese |
| --- | --- | --- |
| Home | / | /en/, /ja/ |
| About | /about/ | /en/about/, /ja/about/ |
| Approach | /approach/ | /en/approach/, /ja/approach/ |
| Discography | /discography/ | /en/discography/, /ja/discography/ |
| Contact | /contact/ | /en/contact/, /ja/contact/ |

Canonical URLs now match chapter names. Legacy /members/, /story-types/, /projects/ and /works/ URLs redirect directly to the new URLs in all languages and preview. News and RSS are retired; their old generated files are removed during build and return 404 after deployment. The sitemap contains only the five chapters in all three languages (15 URLs). Individual work pages are retired too: they are no longer built, linked or indexed, and their old URLs return 404. Retired content is kept in archive/ and never staged for publication.

## Sources and checks

- Page shell: src/page.html
- UI: src/app/template.html, component.js, parts/*.js
- Styles: src/styles/site-and-dialogs.css, discography.css and story-journey.css; generated assets/css/works.css preserves their order.
- Copy: assets/data/site-content.json
- Search titles, descriptions and route registry: assets/data/seo-content.json
- Works and audio gain: assets/data/works-data.json
- Discography/player: assets/js/works.js
- Site accessibility: assets/js/site-ux.js
- Preview (/preview/, noindex): the new journey site from scripts/journey-page.mjs, src/journey/journey.css and src/journey/journey.js, on the same data. Live pages are unaffected.

Node 24+. Run npm run build, npm run check, or npm test. Generated files are ignored by Git. Build/check need no dependencies; npm install is only needed for optional sharp image tooling. Set CHROME_PATH to run node .github/scripts/validate-runtime-performance.mjs locally. Both deployment and validation run browser checks.

Serve the repository root over HTTP for local previews; file URLs are unsupported. The Pages deployment stages public entry points only. The live commit is exposed at /version.txt.

## Search registration

After deploying, submit https://taletone.net/sitemap.xml in Google Search Console and Naver Search Advisor, then request recrawling of the five Korean chapter URLs. Existing Naver/Bing ownership verification tags are preserved. Account-side submission is separate from generating metadata and requires the site's owner account. See SEARCH_REGISTRATION.md for the exact checklist.
