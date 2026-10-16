# Preview sources (taletone.net/preview/, noindex)

Work-in-progress copies of the live sources. `npm run build` turns them into `preview/` only; the live site keeps using `src/` and `assets/`.

| Preview source | Live source |
|---|---|
| `app/template.html`, `app/component.js` | `src/app/` |
| `data/site-content.json`, `data/works-data.json` | `assets/data/` |
| `js/works.js`, `css/works.css` | `assets/js/`, `assets/css/` |

When a redesign is approved, copy these over the live sources, rebuild, and delete this folder's changes.
