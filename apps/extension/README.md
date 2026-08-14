# Rangrez — browser extension

Try-on while you shop (PRD §4.3, Flow D). Finds the clothes on a product page,
works out what the piece actually is, picks the cleanest photograph of it out of
the gallery, and hangs it on the same avatar the wardrobe uses — without leaving
the tab.

Ships for **Chrome and Firefox from one source tree.** The only difference is
the manifest — Chrome runs the background in a service worker, Firefox in an
event page — so the two can't drift apart. Anything that differs at runtime is
handled in [`src/lib/api.js`](src/lib/api.js), not by forking a file.

---

## Install

```bash
npm run dev --workspace rangrez
```

**Chrome** — no build step, the folder *is* the extension:

1. `chrome://extensions` → switch on **Developer mode**
2. **Load unpacked** → pick this folder (`apps/extension`)

**Firefox** — one command to lay out the event-page manifest:

```bash
node apps/extension/build.mjs
```

1. `about:debugging` → **This Firefox** → **Load Temporary Add-on**
2. Pick `apps/extension/dist/firefox/manifest.json`
3. Firefox treats MV3 host permissions as *optional*, so nothing injects until
   you allow it. Open the Rangrez popup and hit **Grant site access** — or do it
   from `about:addons` → Rangrez → Permissions.

Then, in either browser:

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

We want the shot that shows the whole garment — on a model or laid flat — and
never a close-up of the weave. Each photograph is scored on six measurements:

| Measurement | Weight | Why |
| --- | --- | --- |
| Structure | 0.26 | Block-average to 32px: fabric texture vanishes, a collar or silhouette survives |
| Backdrop uniformity | 0.24 | Low edge deviation = seamless studio backdrop |
| Framing | 0.22 | Too little subject is a swatch; too much is a scene |
| Skin fraction | 0.14 | Mild lean toward a flat lay — a model shot is perfectly usable |
| Resolution | 0.10 | After the thumbnail→full-size rewrite |
| Aspect | 0.04 | A 3:1 image is a banner, not a product |

**Structure is the one that matters.** Without it a macro of the fabric wins
outright: it has no border deviation (a perfect "clean backdrop") and no skin
(a perfect "not a model shot"). That is a real bug this had — the try-on came
back looking like a swatch. Anything scoring below the structure/coverage floor
is flagged a swatch and multiplied down to 12%, so it can still be chosen if a
gallery is nothing but close-ups, but never otherwise. Collages get the same
treatment at 45%: VTO transfers whatever it's shown, and a three-view tile
produces a garment with three collars.

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

Clothes, shoes, bags, hats and jewellery all have YouCam surfaces, and the
classifier routes each to the right one. **Eyewear is the only category with no
endpoint at all** — it's still recognised, and the panel says so plainly rather
than spending a call to fail.

---

## Layout

```
manifest.json          Chrome  — background as a service worker
manifest.firefox.json  Firefox — background as an event page + gecko id
build.mjs              lays both out into dist/ (--zip for store uploads)
src/
  background.js        token, API, image fetch, pixel analysis
  pair.js              reads the handshake token off /connect (localhost only)
  popup.html/.js       status: paired? avatar? mock or live? permissions?
  lib/api.js           browser ?? chrome — the whole cross-browser story
  lib/api-global.js    the same, for classic content scripts
  lib/score.js         candidate scoring, pure so it can be tested
  lib/taxonomy.js      garment classification
  lib/sites.js         per-platform selectors + CDN rewrites
  content/detect.js    product + gallery extraction
  content/panel.js     shadow-DOM trigger and panel
  content/main.js      orchestration, SPA navigation
assets/                icons + the three brand fonts
test/
  logic.test.mjs       classification + URL rewrites   (node, no deps)
  score.test.mjs       image picking, incl. the fabric-macro trap
  harness.html         every panel state, plus detect() on fixture markup
```

## Tests

```bash
node apps/extension/test/logic.test.mjs   # 40 assertions
node apps/extension/test/score.test.mjs   # 10 assertions
npx web-ext lint --source-dir apps/extension/dist/firefox
```

`logic` covers classification and the CDN rewrites, including the ordering traps
(`denim jacket`, `dress shirt`, `shirt dress`, `short sleeve shirt`) and the
negative cases (a laptop is not a garment). `score` runs synthetic pixels
through the picker and pins the ordering: fabric macro and logo crop below,
model shot and flat lay above.

For the UI, serve this folder and open `test/harness.html` — every panel state,
plus `detect()` against Amazon-shaped fixture markup, with the extension APIs
stubbed. Nothing in `test/` ships.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | the pairing token, the API origin, and per-site dismissals |
| `host_permissions: https://*/*` | the service worker fetches garment images from whatever CDN the shop uses, and calls your Rangrez origin |
| content scripts on all sites | the trigger and panel — clothing stores are not a knowable list |
| content script on localhost | pairing only — see above |

The content script stays inert unless the page is a product page *and* the
classifier recognises a garment.

**On Firefox** host permissions are optional under MV3: declared in the
manifest, but not granted until you say so. Nothing injects until you allow it,
which the popup offers on first open. Chrome grants them at install.

No analytics, and no page content leaves the browser except the one garment
image you asked to try on.
