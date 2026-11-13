# TALETONE MUSIC

GitHub Pages static site: https://taletone.net

## Current chapters

| Chapter | Korean URL | English / Japanese |
| --- | --- | --- |
| Home | / | /en/, /ja/ |
| About | /about/ | /en/about/, /ja/about/ |
| Philosophy | /approach/ | /en/approach/, /ja/approach/ |
| Discography | /discography/ | /en/discography/, /ja/discography/ |
| Contact | /contact/ | /en/contact/, /ja/contact/ |

Canonical URLs now match chapter names. Legacy /members/, /story-types/, /projects/ and /works/ URLs redirect directly to the new URLs in all languages, and so do the retired /preview/ addresses. News and RSS are retired and return 404. The sitemap contains only the five chapters in all three languages (15 URLs). Individual work pages are retired too: they are no longer built, linked or indexed, and their old URLs return 404. The business card's link page is at /link/ (not indexed, not in the sitemap; its buttons are in assets/data/links.json).

## Sources and checks

- How it is built, folder by folder and part by part: ARCHITECTURE.md.
- The site: the journey, built by scripts/build.mjs (data from scripts/journey-data.mjs, HTML from scripts/journey-page.mjs, the script from src/journey/js/, the styles from src/journey/css/), at the five chapter routes in three languages. /preview/ redirects to it.
- Copy: assets/data/site-content.json (the `journey` block and its translations)
- Search titles, descriptions and route registry: assets/data/seo-content.json
- Works, tracks, their official titles and audio gain: assets/data/works-data.json, by the model in scripts/works-model.mjs (fields, where media resolve, the rules). `npm run audit` shows every album track by track, any problem, and files nothing uses.

Node 24+. Run npm run build, npm run check, or npm test. Generated files are ignored by Git. Build/check need no dependencies; npm install is only needed for optional sharp image tooling. Set CHROME_PATH to run node .github/scripts/validate-runtime-performance.mjs locally. Both deployment and validation run browser checks.

Serve the repository root over HTTP for local previews; file URLs are unsupported. The Pages deployment stages public entry points only. The live commit is exposed at /version.txt.

## Search registration

After deploying, submit https://taletone.net/sitemap.xml in Google Search Console and Naver Search Advisor, then request recrawling of the five Korean chapter URLs. Existing Naver/Bing ownership verification tags are preserved. Account-side submission is separate from generating metadata and requires the site's owner account. See SEARCH_REGISTRATION.md for the exact checklist.
