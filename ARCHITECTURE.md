# How the site is built

taletone.net is one story told in a phone: the visitor scrolls through a land, a sea and space to the record of
every work, and ends at the inquiry. It is a static site: `scripts/build.mjs` turns data and sources into
plain files, and GitHub Pages serves them. There is no framework, no bundler and no runtime dependency.

Read this first, then the file you need. Every source file starts with a comment saying what it is for.

## The flow

```
assets/data/works-data.json ──► scripts/works-model.mjs ──┐   what a work is, where its media are, its rules
assets/data/site-content.json ───────────────────────────┼─► scripts/journey-data.mjs ─► window.TT_JOURNEY
                                                          │      (each language: works, copy, other work)      assets/journey/data-{kr,en,jp}.js
                                                          └─► scripts/journey-page.mjs ─► the HTML of each page
assets/data/seo-content.json ─► scripts/build.mjs ─► titles, canonical, hreflang, social cards, sitemap.xml, redirects
src/journey/js/*.js  ─► (joined in file-name order) ─► assets/journey/journey.js    the stage, played by scroll
src/journey/css/*.css ─► (joined in file-name order) ─► assets/journey/journey.css
```

In the browser a page is its HTML (every chapter, every work, readable without script), its data script and
`journey.js`. A tiny script in the head sets `jy-stage-mode` (and `jy-narrow` on phones and upright screens)
before the first paint; `journey.js` then plays the chapters on a fixed canvas as the visitor scrolls.

Generated files (the route pages, `assets/journey/`, `sitemap.xml`, `preview/`) are not in Git. The deploy
builds them; locally, `npm run build`.

## Where things are

| Path | What it is |
|---|---|
| `assets/data/works-data.json` | Every work and album track: titles, credits, cover, small cover, audio, video, vinyl colours. |
| `assets/data/site-content.json` | The words. `journey` holds the story's own copy with `translations.en` / `.jp`; the story also reads `members` (the profile), `projects` (the case and the steps), `contact` (the form), `membersMeta`, `footerMeta`, `trackRecord`, `partners`, `home`, `worksMeta`, `mixWorks` and `bgmWorks` (Sound Engineering, ETC), `videoDates`. |
| `assets/data/seo-content.json` | The five chapter routes, their titles and descriptions, the site name, analytics. |
| `scripts/works-model.mjs` | The model of a work: allowed fields, `mediaOf()` (where a cover, small cover, sound and video come from), `checkWorks()` (the rules), `orphans()`. Everything that reads works goes through it. |
| `scripts/journey-data.mjs` | Data → what the page shows, per language. |
| `scripts/journey-page.mjs` | That data → the HTML document. |
| `scripts/build.mjs` | Runs all of the above and writes every generated file; `--check` fails if one is stale. |
| `scripts/audit-works.mjs` | `npm run audit`: each album track by track, problems, unused files. |
| `src/journey/js/` | The page's script, in parts (below). |
| `src/journey/css/` | The page's styles, in parts (below). |
| `assets/works/` | Covers (`*-1024.webp`, small `*-w320.webp`) and sounds (`*.mp3`). |
| `assets/phone/case-back.svg`, `case-stars.svg` | The back of the home phone: the designer's draft drawn as vectors (measured from it), 9:16, with the company's Outline mark (2px line); its stars alone, for the holographic sheen. |
| `assets/logo/logo-ink.svg`, `logo-paper.svg` | The company mark, Filled (the default form), in ink and in paper colour. In a conversation (the avatars, the chat room) it is ink on the pale light of the invitation's icon (`--tt-light-pale`); as an app icon or profile it is cut out of the brand's light; beside the name and on the link previews it is filled with that light; the top bar keeps the plain ink/paper mark. |
| `assets/fonts/`, `assets/logo/`, `assets/icons/`, `assets/social/`, `assets/video/` | Fonts (LINE Seed KR, Quicksand), logo marks, app icons, link previews, the lock screen's film. |
| `.github/scripts/validate-site.mjs` | Static checks of the built site (every page's tags, links, files, redirects, the works' rules). |
| `.github/scripts/validate-runtime-performance.mjs` | Headless Chrome: every route × language × three screens, the whole story scrolled, a record played, the inquiry; load budgets. |
| `.github/workflows/` | `site-validation.yml` on every push; `deploy.yml` on `main`: build, check, publish. |
| `tests/` | `npm test`: the works rules (each case a mistake that once happened), the pages, the redirects, the deploy stage. |
| `archive/` | Retired content, never published. |

## The script, part by part (`src/journey/js/`)

All parts share one scope: a name declared in one is visible in the later ones, and two parts may not declare
the same name (the build's syntax check fails). Numbers leave room to insert a part.

| Part | What it does |
|---|---|
| `00-base` | The data, the timeline (`CH`, `TOTAL`), the things in each world (`OBJ`, `SET`), the pen's path (`PEN`), helpers. |
| `10-audio` | One sound at a time; versions by language; volume. |
| `12-vinyl-colours` | Records take their colours from the data (or sample their cover). |
| `14-dialogs` | Focus stays inside a dialog; Esc closes; focus returns. |
| `20-detail` | A work opened: video or cover, facts, credits, versions, tracks, covers. |
| `22-player` | The player that follows what is playing. |
| `24-profile`, `26-chapter-menu`, `28-filters` | The profile sheet, the chapter list, the discography's filters. |
| `30-inquiry` | The form: checks, sending (Web3Forms), the reply. |
| `32-shelf-and-go` | Sound Engineering and ETC cards; `go()`, moving to a chapter from any link. |
| `40-stage-setup` … `46-stage-phone-ui` | The stage's canvas and scroll track, the entry (`ENTER`: glitch, dark, points, drawn in), shared state, phone sheets. |
| `47-stage-phone-tilt` | The phone's back in 2.5D: the card tilts toward the pointer, a band of light slides across the case, the stars turn holographic (`assets/phone/case-stars.svg`); layers between the faces give it depth. |
| `48-stage-scenes` | How the story moves: up to the discography it waits after every second message (`STOPS`) and goes on one leg at a time (`LEGS`) when asked; scenes play by themselves to their end (`AUTO`, with steps; nothing stops one midway to ask for input), input. |
| `49-stage-next` | The story's controls while it waits for clicks: the next message's place, marked like a notification (a click plays the next leg), and a way straight to the discography. |
| `50-stage-clock` | The lock screen's clock (the visitor's own time). |
| `52-stage-world` | The world in depth: the line's path, the camera (`rig`), building the world. |
| `54-stage-conversation` | The messages along the line (`ANCHORS`), said like slides two at a time (`SLIDES`), under the chapter's name (the room). |
| `55-stage-forming` | How a thing comes into being as the line comes (`formAt`): scattered points ahead, gathering into its outline, the outline drawn, then filled and coloured as the pen reaches it. |
| `56-stage-scenery` | Drawing the land and sky, the sea, space, and the line; each thing through `formAt`, the sky's colour spreading in over the first stretch. |
| `58-stage-phone-passage` | The phone between worlds (approach, wake, pull: `PH`, `phoneIn`) and `drawWorld`. |
| `60-stage-record` | The record: the staff as a 3D current with every work, album tracks on a cord, the card. |
| `62-stage-loop` | The frame loop: what each frame draws for the scroll position; resize; `stage`, the stage's interface. |
| `90-start` | Where the visitor came in (route, `?work=`). |

The timeline is in scroll units `u` (`CH` in `00-base`): `pro 0–1, tale 1–4.5, tone 4.5–8.1, case 8.1–12.1,
music 12.1–13.7, record 13.7–17.7, done 17.7–18.6, epi 18.6–19.6`. Inside tale to music the camera follows a pen
along the line at depth `z`; `uOfPen(z)` converts. Each message is written at a thing in its world (every other
pole, jellyfish or star: `SET`), so the words arrive at a pace that can be read.

## The styles, part by part (`src/journey/css/`)

Joined in order, so a later part wins where two overlap: `00-base` (fonts, tokens, header), `10-column` (the
readable column without script), `20-panels` (profile, detail), `30-stage`, `40-stage-pieces` (first screen,
player, trail, case), `50-stage-narrow` (phones and upright screens), `60-record-tabs` (shelf, history, detail
credits), `70-chat-room`, `80-tablet` (an upright tablet, shown to a room).

## Common changes

| To | Edit | Then |
|---|---|---|
| Add or fix a work or a track | `works-data.json` (the fields in `works-model.mjs`) | `npm run audit`, `npm run check` |
| Change words | `site-content.json` (`journey`, and its `translations`) | `npm run check` |
| Change a title or description for search | `seo-content.json` | `npm run check` |
| Change how a scene plays or looks | the part in `src/journey/js/` named for it | `npm run check` and the runtime check |
| Change a style | the part in `src/journey/css/` named for it | `npm run check` |
| Add a field to works | `WORK_KEYS` / `TRACK_KEYS` and `mediaOf` in `works-model.mjs` first | `npm test` |

## Checks

- `npm run check`: build, static site check, tests. No dependencies.
- `npm run audit`: what every work resolves to. Run it before deciding a file is missing.
- `CHROME_PATH=… node .github/scripts/validate-runtime-performance.mjs`: the browser check CI runs.
- Deploy: push or merge to `main`; `/version.txt` shows the live commit.
