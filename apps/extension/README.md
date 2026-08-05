# Rangrez — Chrome extension

Try-on while you shop (PRD §4.3, Flow D). Finds the clothes on a product page,
works out what the piece actually is, picks the cleanest photograph of it out of
the gallery, and hangs it on the same avatar the wardrobe uses — without leaving
the tab.

**There is no build step.** The folder *is* the extension.

---

## Install

```bash
npm run dev --workspace rangrez
```

1. `chrome://extensions` → switch on **Developer mode**
2. **Load unpacked** → pick this folder (`apps/extension`)
3. Open <http://localhost:3000/connect> while signed in — the extension reads its
   key off that page on its own. Nothing to copy.
4. Open a product page on Amazon, Myntra, Flipkart, Ajio, Zara or H&M.

A small mark appears bottom-right when it finds clothes. `×` hides it for that
site; the popup can un-hide them all.

### Deploying the app somewhere else

The pairing content script trusts **localhost only**. That is deliberate — it
reads a bearer token off the page, and a wildcard like `*.vercel.app` would let
any other tenant hand the extension somebody else's token. Add your exact origin
to the second `content_scripts` entry in `manifest.json` when you deploy.

---

## How it works

```
detect  →  offer  →  isolate  →  render  →  save
```

| Step | Where | What happens |
| --- | --- | --- |
| **detect** | `src/content/detect.js` | JSON-LD `Product` → OpenGraph → the site adapter, in that order of trust. Title + brand + breadcrumbs + category go to the classifier. |
| **classify** | `src/lib/taxonomy.js` | Ordered rules, most specific first. The order *is* the logic — "denim jacket" must resolve as outerwear before the denim rule claims it as a bottom. Decides the VTO category and the wardrobe rail. |
| **offer** | `src/content/panel.js` | A small mark, bottom-right, in a shadow root. Nothing is injected into the page's layout. |
| **isolate** | `src/background.js` | Every gallery image is fetched, drawn to a 96px `OffscreenCanvas`, and scored on four measurements. Highest score wins. |
| **render** | `apps/web/app/api/extension/tryon` | Winner + avatar → Apparel VTO. Task-based, so the panel shows real progress. |
| **save** | `apps/web/app/api/extension/save` | The render becomes a catalog item — same avatar, same grid, same palette ranking as a closet upload. |

### The isolation pass

Apparel VTO wants a garment, not a scene. A flat product shot on seamless white
transfers far more faithfully than the hero shot of a model wearing it in a
field, so we score each photograph and pick the cleanest:

| Measurement | Weight | Why |
| --- | --- | --- |
| Backdrop uniformity | 0.38 | Low edge deviation = seamless studio backdrop |
| Skin fraction | 0.28 | Graded penalty, not a veto — some galleries are model shots all the way down |
| Framing | 0.18 | Too little subject is a swatch; too much is a scene |
| Resolution | 0.16 | After the thumbnail→full-size rewrite |

The same pass returns the garment's average colour, which the wardrobe snaps to
the nearest house dye when you save it.

### Thumbnail → full size

Every one of these sites serves a 128px thumbnail in the DOM; feeding that to
VTO produces mush. Each CDN encodes its size in the URL, so the original is one
substitution away — no extra requests, no hi-res gallery scraping.

```
amazon    .../I/71abc._AC_UY327_FMwebp_QL65_.jpg  →  .../I/71abc.jpg
myntra    dpr_1.5,q_60,w_210,c_limit              →  q_90,w_1080,c_limit
flipkart  /image/128/128/…?q=70                   →  /image/832/832/…?q=90
ajio      -473Wx593H-                             →  -1117Wx1400H-
```

Anything unlisted falls through to a generic adapter that reads JSON-LD and
OpenGraph — which covers most Shopify storefronts for free.

### What it will not do

Apparel VTO dresses a body. It does not hang jewellery or fit shoes. Those are
still recognised — a chain is classified as a chain — and the panel says so
rather than spending a call to fail.

---

## Layout

```
manifest.json
src/
  background.js        service worker — token, API, image fetch, pixel analysis
  pair.js              reads the handshake token off /connect (localhost only)
  popup.html/.js       status: paired? avatar? mock or live?
  lib/taxonomy.js      garment classification
  lib/sites.js         per-shop selectors + URL rewrites
  content/detect.js    product + gallery extraction
  content/panel.js     shadow-DOM trigger and panel
  content/main.js      orchestration, SPA navigation
assets/                icons + the three brand fonts
test/
  logic.test.mjs       classification + URL rewrites  (node, no deps)
  harness.html         every panel state, plus detect() on fixture markup
```

## Tests

```bash
node apps/extension/test/logic.test.mjs
```

30 assertions over classification and the URL rewrites, including the ordering
traps (`denim jacket`, `dress shirt`, `shirt dress`, `short sleeve shirt`) and
the negative cases (a laptop is not a garment).

For the UI, serve this folder and open `test/harness.html` — it renders every
panel state and runs `detect()` against Amazon-shaped fixture markup, with
`chrome.*` stubbed. Nothing in `test/` ships.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | the pairing token, the API origin, and per-site dismissals |
| `host_permissions: https://*/*` | the service worker fetches garment images from whatever CDN the shop uses, and calls your Rangrez origin |
| content scripts on the shop list | the trigger and panel |
| content script on localhost | pairing only — see above |

No analytics, no page content leaves the browser except the one garment image
URL you asked to try on.
