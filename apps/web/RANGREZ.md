# RANGREZ — Product Memory

> **رنگریز · rangrez** — *the dyer of cloth.* The one who takes plain fabric and gives it colour.
> Formerly codenamed **Fitloom**. All product references renamed to **Rangrez** as of 2026-08-05.

**AI Wardrobe & Virtual Try-On Platform** · Built on YouCam API (Perfect Corp) · PRD v1.0 · Hackathon build

---

## 1 · Overview

Rangrez turns real photos of outfits someone has already worn into a digital, swipeable wardrobe. Every
piece gets rendered onto the user's own body using generative virtual try-on, so the user can mix and match
tops/bottoms/layers on their own avatar, get outfit recommendations based on their personal colouring, and
try on clothes directly while shopping online — all without a fitting room.

**Problem:** online shopping is a guessing game (fit, look, worth-the-return-shipping) and people's existing
wardrobe lives scattered across camera rolls with no way to actually plan or remix outfits.

**Solution:** one base avatar photo, generated via YouCam's Apparel VTO, becomes the canvas for every outfit
the user owns or is considering buying — browsable like a Sims-style customization screen.

**The core insight: the avatar is the constant.** Every garment — uploaded from the closet or tried on from a
store page — renders onto *the same body*. That consistency is what makes the wardrobe feel like a wardrobe
instead of a folder of screenshots.

---

## 2 · Goals & success metrics (hackathon demo scope)

| Goal | Metric |
| --- | --- |
| Digitize a real wardrobe fast | Upload → cataloged outfit in under 15 sec per item |
| Make outfit mixing effortless | Swipe to change top/bottom layer in under 1 sec (cached renders) |
| Reduce online-shopping guesswork | 1-click try-on from any product page via extension |
| Personalize style guidance | Colour palette + fit suggestions generated from skin tone analysis |
| Prove it's not a wrapper | Independent recommendation + catalog logic layered on top of YouCam calls |

---

## 3 · Target user

- Online shoppers who hesitate at checkout because they can't picture fit/look on themselves
- People who forget half their closet exists and re-buy similar items
- Style-curious users who want colour-matched outfit ideas without hiring a stylist

---

## 4 · Core features

### 4.1 Wardrobe Dashboard
- Upload past outfit photos (fits already worn) in bulk or one at a time
- System auto-extracts individual garments (top, bottom, outerwear, shoes, accessories) from each photo
- Each garment is virtually re-rendered onto the user's saved avatar via Apparel VTO, and stored as its own
  catalog item, tagged by category, dominant colour, and season
- Grid + list views, search/filter by category or colour

### 4.2 Swipe-to-Style Customizer ("Sims mode")
- Avatar shown center-screen, layered by zone: top / bottom / outerwear / shoes / accessories
- Swipe left/right on any zone independently to cycle through catalog items in that category
- Each new combination composited live (cached renders per garment → no repeat API calls for known combos)
- "Save this fit" bookmarks a combo as a named outfit; "Surprise me" auto-rolls a random valid combination

### 4.3 Chrome Extension — instant try-on while shopping
- Floating non-intrusive button injected on product pages
- On click: scans the page's product image(s), detects the garment currently being viewed
- Garment image + saved avatar → Apparel VTO → render returns in a small popup overlay (no navigation away)
- Popup includes "Save to Wardrobe" so the try-on result lands in the dashboard catalog

### 4.4 Colour Palette Recommender
- YouCam skin tone / personal colour detection on the avatar photo → colour season (warm autumn, cool winter…)
- Wardrobe items and swipe suggestions ranked/highlighted when inside the user's flattering palette
- "Surprise me" weighted toward colour-season-matching combinations first

### 4.5 General / supporting
- Onboarding flow to capture a clean, front-facing base avatar photo (lighting/pose guidance)
- Outfit history log (tried / saved / worn-on-date)
- Basic auth + per-user private catalog storage

---

## 5 · User flows

- **A — Onboarding:** Sign up → guided photo capture tips → upload base avatar photo → YouCam skin tone
  analysis runs once → colour season stored on profile → dashboard unlocked (empty state, prompts first upload).
- **B — Digitizing a worn outfit:** Upload outfit photo(s) → garment segmentation extracts pieces → each piece
  sent to Apparel VTO against the avatar → renders + tags saved to catalog → confirmation screen lets the user
  correct any mis-tagged category before saving.
- **C — Swipe styling session:** Open dashboard → avatar loads with last-used fit → swipe per zone → cached
  render or fresh VTO call → "Save Fit" to bookmark, or "Surprise Me" for a colour-weighted random combo.
- **D — Shopping extension try-on:** Product page → click floating Rangrez button → extension grabs product
  image → product image + avatar → Apparel VTO → popup shows render → "Save to Wardrobe" or dismiss.

---

## 6 · Tech stack

| Layer | PRD choice | What we actually built (and why) |
| --- | --- | --- |
| Frontend | React + Vite, Tailwind | **Next.js 15 (App Router) + Tailwind v4** — same React/Tailwind DX, but server routes let us keep the YouCam key server-side instead of standing up a separate Express process. One deploy target for the hackathon. |
| Swipe/gesture | Framer Motion | **Framer Motion (`motion`)** — as specced |
| Chrome extension | Manifest V3, content script + popup | **Built — `apps/extension`.** MV3, no build step (the folder is the extension). Shadow-DOM surface, service worker for network + pixel analysis. See its README. |
| Backend | Node + Express / FastAPI | **Next.js route handlers + server actions** — the REST proxy layer for YouCam, polling, auth |
| Garment segmentation | SAM / cloth segmentation, server-side | not started yet |
| Database | Postgres / Firebase | **JSON file store at `.data/`** behind a `lib/db.ts` seam — swap to Postgres without touching callers |
| Image storage | S3 / Cloudinary | **`public/uploads/`** behind the same seam |
| Async jobs | BullMQ / polling loop | **Polling loop in `lib/youcam.ts`** (VTO is task-based) |
| Auth | Firebase Auth / Clerk | **Dummy HMAC-signed cookie session** — deliberately thin, one provider swap away from Sign in with Google |

---

## 7 · YouCam API usage map

**Verified contract (probed against the live API, 2026-08-05).** Note the version split — files are
v1.0 and key off `result`; tasks are v2.0 and key off `data`. The v2.0 task body is flat, *not* the
nested `payload.file_sets.actions` envelope the older docs describe. Polling is a path segment; GET on
the bare task path returns 405.

```
POST /s2s/v1.0/client/auth            → result.access_token          (RSA id_token)
POST /s2s/v1.0/file/cloth             → result.files[0].{file_id, requests[0]}
PUT  <pre-signed S3 target>           → the image bytes
POST /s2s/v2.0/task/cloth             → data.task_id
     { src_file_id, ref_file_id, garment_category }
GET  /s2s/v2.0/task/cloth/{task_id}   → data.{task_status, error, error_message, results}
```

`garment_category` is `upper_body` | `lower_body` | `full_body`. A live render takes ~19s. Engine
failures come back with genuinely useful text (`error_pose` → "ensure the chest and shoulders are
clearly visible"), so it's surfaced verbatim rather than flattened.

Sibling surfaces exist and answer: `/s2s/v2.0/task/shoes`, `/s2s/v2.0/task/bag`,
`/s2s/v2.0/task/2d-vto/earring`. So the extension's "not yet" on shoes and jewellery is a scope line,
not an API limit. `yce-api-01.perfectcorp.com` and `yce-api-01.makeupar.com` both serve all of it.

| Feature | YouCam API | Call pattern |
| --- | --- | --- |
| Base avatar creation | Apparel VTO (initial reference) + Skin Tone / Personal Colour Analysis | One-time at onboarding; store colour season on profile |
| Outfit digitization | Apparel VTO | Per extracted garment: garment image + avatar → `task_id` → poll → store result URL |
| Swipe customizer | Apparel VTO (cached per combination) | First view of a zone-combo triggers a call; repeats reuse cache |
| Extension try-on | Apparel VTO | Product image + avatar → `task_id` → poll → popup, also saved to catalog |
| Colour palette | Skin Tone / Personal Colour Detection | One-time (re-run on new avatar photo); output drives client-side ranking |

**Output format note (important):** Apparel VTO is **task-based and asynchronous**. Every call returns a
`task_id` first; the real result is a **generated image URL** (not a 3D model), retrieved by polling or webhook.
Build loading states into every VTO-triggering interaction, and cache per garment/combination to control both
latency and API credit spend.

---

## 8 · Why this isn't "just a wrapper"

- Garment segmentation pipeline (extracting pieces from a worn-outfit photo) is custom logic, not a YouCam feature
- Swipe-based catalog + caching layer is an original interaction/data system on top of raw VTO calls
- Colour-season-aware recommendation and "Surprise Me" logic is independent ranking logic
- Chrome extension page-scanning + non-invasive popup UX is a full separate product surface

---

## 9 · MVP vs stretch

| MVP (build first) | Stretch |
| --- | --- |
| Onboarding + base avatar + colour season | Full page auto-detection across arbitrary e-commerce sites |
| Manual outfit upload + catalog (segmentation may be semi-manual) | Automatic multi-garment segmentation from one photo |
| Swipe customizer with 2–3 zones (top/bottom minimum) | Full zone set incl. accessories/shoes/outerwear |
| Extension: manual "select this image" try-on | One-click fully automatic detection + instant popup |
| Colour palette as simple palette + match badges | Weighted "Surprise Me" using full palette scoring |

---

## 10 · Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| VTO polling latency slows the swipe demo | Pre-generate/cache common combinations before the live demo |
| Segmentation quality varies on messy photos | Quick manual crop/confirm step as fallback |
| API credit limits during testing | Cache aggressively; reuse renders across dev/test |
| Extension flagged as invasive | Click-triggered only, no auto-scraping on load, no data sent beyond the try-on call |

---

## 11 · Design language (build decisions, not in the PRD)

The name is the brief. A *rangrez* is a dyer — so the surface is a **dye house / textile atelier**, not a
minimal SaaS dashboard.

**Palette** (natural dyes)

| Token | Hex | Role |
| --- | --- | --- |
| `--paper` | `#EDE7DA` | khadi / undyed cloth — the base |
| `--ink` | `#14120E` | iron-gall black — type, rules |
| `--indigo` | `#26356E` | the dyer's vat — primary accent |
| `--madder` | `#B03A21` | madder root — live / active states |
| `--turmeric` | `#D99B21` | haldi — highlights, match badges |
| `--vat` | `#1B2447` | deep field backgrounds |

**Type** — three voices, deliberately contrasted:
- **Instrument Serif** — display. High-contrast fashion masthead. Italic for the editorial asides.
- **Inter Tight** — UI and body. Tight, neutral, gets out of the way.
- **JetBrains Mono** — metadata, spec-sheet labels, index numbers. Uppercase, wide tracking, small.

**Rules of the house:**
1. Not minimalism. Hairline rules, ruled gutters, index numbers (`01 / 24`), rotated spine text, grain overlay.
2. The grid breaks on purpose. Editorial tiles span wide/tall inside a tight H&M/Zara product grid.
3. Metadata is decoration. Category, dye colour, season, VTO status all shown as tracked-out mono.
4. Every image is duotone-treated so a bag of random placeholder photos still reads as one lookbook.
5. Motion is fabric: things settle, they don't bounce.

---

## 12 · Build state

**Done**
- **Auth** — Supabase Auth (accounts live in the Authentication tab), email + password and Sign in with
  Google, sessions as Supabase cookies so "stay logged in" isn't ours to implement
- **Storage** — Supabase Postgres, RLS on with no anon policies; every query in `lib/db.ts` scopes by
  `user_id` and the server holds the secret key
- Dashboard — editorial wardrobe grid, filters by rail / colour / **source**, full CRUD behind the ⋯ menu
- **Up to three avatar plates** per account, one active. Shelf in the profile (`AvatarShelf`), compact
  switcher on the wardrobe (`PlateSwitcher`), and each plate carries its own colour season — switching
  re-ranks the wardrobe, which is our maths and costs no API credit.
- **Upload from your own photos** (`UploadDock`) — the garment is cut out **in the browser**
  (`lib/extract.ts`: subject box off the corner colour, cropped, centred on white), so the server only
  ever sees a ~200KB square. Rows land in the grid immediately as "queued"; the VTO renders follow
  three at a time. The grid shows the piece, and hover crossfades to the piece **worn**.
- Avatar studio (`/atelier`) — photo upload, capture guidance, YouCam call, colour-season result,
  `?replace=<id>` to re-shoot a plate in place
- `lib/youcam.ts` — S2S auth + task-poll client with a **mock mode** so the app runs before the key lands
- **Chrome + Firefox extension (`apps/extension`)** — PRD §4.3 / Flow D. Detects garments on Amazon,
  Myntra, Flipkart, Ajio, Zara and H&M (plus a JSON-LD/OpenGraph fallback for everything else),
  classifies the piece, scores every gallery photograph to pick the one that isolates the garment best,
  renders it onto the chosen avatar, and saves the result into the same catalog. Shoes, bags, hats and
  the jewellery family all have surfaces; only eyewear is honestly refused.
- **The extension asks which body — only when there is more than one.** The gallery read starts before
  the question so the two overlap.
- **Extension API** — `/api/extension/{session,tryon,save}`, bearer-token auth (`lib/ext-token.ts`),
  CORS confined to those routes, SSRF-guarded remote image fetch (`lib/fetch-image.ts`)
- **`/connect`** — pairing page. The extension lifts its token off the page; nothing to copy.

- **Look creator (`/look`)** — PRD §4.2, the Sims-mode feature, and the one page in the product that is
  a *room* rather than a spec sheet. It owns exactly one viewport and never scrolls (the colophon hides
  itself there); the whole page is lit by three colours in `--look-a/b/c`, registered with `@property`
  so the browser interpolates them and the light **drifts** between moods instead of cutting. Idle, it
  cycles the vat's own dyes; with clothes on the body it takes their colours.
  Hierarchy is the design: the body is centre, the slot rail sits above it, and the two card wheels are
  hubbed below the bottom corners — `rotate(θ) translateY(-R)` puts each card on the rim standing
  radially, so turning really does carry one side up and over the top. Scrolling over a wheel spins it.
  Cards are CSS 3D rather than WebGL: every card stays a real DOM node, so images lazy-load and the
  wheels are keyboard-reachable.
  Rim z-order is **monotonic**, not peaked at the front. Peaking it put one card on top of both its
  neighbours, and pointer sampling showed it owning ~100× its share of the wheel's hit area — which is
  what made hover feel stuck on a single card. Monotonic ordering brings that ratio to ~1.3×.
  "Build the fit" chains one YouCam render per layer, innermost first, outerwear last, each render
  becoming the next one's body. The client drives the chain (`/api/look/step`) so the body updates as
  each layer lands instead of showing one ninety-second spinner.
- **Avatar framing** — a plate records how much of the body is in shot (`bust` / `knee` / `full`),
  guessed from head-height-to-frame at upload and confirmed by the user. Slots the body can't carry are
  struck out in the look creator and refused by the API, so nobody spends a render fitting trousers to a
  head-and-shoulders photograph.

**Next**
- Move `public/uploads/` to Supabase Storage — it is ephemeral on Vercel, so uploads and mirrored
  renders do not survive a deploy
- True cutout segmentation on upload. `lib/extract.ts` crops and centres but never repaints the
  interior, deliberately: a white shirt on a white sheet is the same colour as its background and
  guessing there destroys the garment.

**Live-verified 2026-08-05:** detection fires correctly on a real Amazon India product page, and a full
try-on has been rendered end to end against the real YouCam API (`mocked: false`, ~19s, garment
transferred onto the user's own avatar with pose and background preserved).

**Known gaps:**
- The skin-analysis feature slug is the one part of the contract still unconfirmed. It's behind
  `YOUCAM_SKIN_FEATURE` and falls back to a deterministic local derivation, so onboarding never breaks.
- Myntra, Flipkart, Ajio, Zara and H&M selectors in `apps/extension/src/lib/sites.js` are unit-tested
  for their URL rewrites but haven't met a live page yet. Amazon has.
- The garment classifier exists **twice** — `apps/extension/src/lib/taxonomy.js` (content script, plain
  JS) and `apps/web/lib/garment-kind.ts` (server + upload dock). Neither can import the other.
  `apps/extension/test/taxonomy-twin.test.mjs` parses both rule tables and fails if they drift.
- `/api/extension/tryon` and `/api/look/step` declare `maxDuration = 120`, above Vercel Hobby's 60s
  ceiling. Each *look* step is one render, so the chain never needs a single long request — but one
  render can still exceed 60s on a slow day.
- The avatar on the pedestal is a photograph, not a 3D model, and can't be one: YouCam returns 2D
  renders. The pedestal, its cast shadow and the colour-reactive backdrop are what give it dimension.
- `tsconfig.json` sets `incremental: true`. A stale `tsconfig.tsbuildinfo` will happily report a clean
  typecheck over files it has already seen — `lib/extract.ts` carried five real errors behind one. If a
  check matters, delete `tsconfig.tsbuildinfo` and `.next/cache/.tsbuildinfo` first.

**Env** — see `.env.example`. `YOUCAM_API_KEY` / `YOUCAM_SECRET_KEY` go in `.env.local`; until then the app
runs in `YOUCAM_MOCK=1` mode and fabricates plausible task responses so every flow stays clickable.
