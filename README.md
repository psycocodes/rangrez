# Rangrez

**One body. Every garment you own, rendered on it and everything you're about
to buy, on the same body, before you buy it.**

Rangrez — *रंगरेज़*, the dyer of cloth, is a wardrobe that knows what you own and
a fitting room that follows you onto every shop page on the internet.

Built by **Gantavya Rohilla** and **Mohikshit Ghorai**.

---

## The problem

**Nobody has their wardrobe in front of them at the moment they need it.**

You are standing in a shop, or three tabs deep on a product page, and you are
being asked a question you cannot answer: *does this go with what I already
own?* Your wardrobe is at home, in a cupboard, half of it forgotten. So you
guess. And the guess fails in the two ways it always fails:

- **You buy the thing you already own.** The fourth black tee. The near-identical
  jacket. Not because you wanted it twice, but because nothing anywhere holds a
  picture of everything you have.
- **You buy the thing that goes with nothing.** It looked good on a model with a
  different body, a different skin tone, and a studio light. On you, against
  your actual trousers, it doesn't.

The industry's answer to the second half is the size chart and the returns
label. Roughly a third of everything bought online goes back, and the single
biggest reason is that people cannot see themselves in it.

**Rangrez answers both halves with the same move: put it on your body.**

Every garment you own is digitised once and rendered onto *your* photograph —
not a model's. So your wardrobe becomes something you can actually look at,
sorted, searchable, and worn. And when the browser extension opens on a product
page, the thing you are considering is rendered onto that same body, next to the
size the shop's own chart says will fit you.

The buying decision stops being a guess. It becomes a comparison — against a
wardrobe you can finally see, on the only body that matters.

---

## Contents

- [The problem](#the-problem)
- [What it does](#what-it-does)
- [The hard parts](#the-hard-parts)
- [The pieces](#the-pieces)
- [Design and UX](#design-and-ux)
- [YouCam (Perfect Corp) API](#youcam-perfect-corp-api)
- [Cutting the garment out](#cutting-the-garment-out)
- [Does it fit?](#does-it-fit)
- [Running it](#running-it)
- [Repository layout](#repository-layout)

---

## What it does

### The landing page

A port of the `v0` Figma frame, pixel for pixel: a collage of rotated cards,
two scrolling tapes and a live demo. **Click to style** fakes a try-on and
reveals the result in the space the two inputs vacate — the whole product in one
gesture, with no account and no API spend. **Start styling** goes to sign-in.

### Your body

One full-length photograph becomes an *avatar plate* — the body every garment is
rendered onto. Up to three per account, so a formal plate and a casual one can
live side by side, and one of them is active at a time.

Each plate is stored twice, and the distinction matters:

| | what it is | where it goes |
|---|---|---|
| `renderUrl` | the photograph, background intact | sent to YouCam |
| `cutoutUrl` | the same body, matted out | shown in the app |

The engine is **never** given the cutout. A matte that clipped a shoulder is a
matte the engine would then fit a jacket to.

### Your wardrobe

A cupboard, not a grid: a brass rod, garments hanging off it, a shoe drawer
underneath. Rails scroll sideways — wheel, drag or arrows — and each garment
swings on its hook, driven by the rail's own velocity plus whatever you pull.

**Every garment holds two pictures, and the card turns over.** The front is the
isolated cutout — what it *is*. The back is you wearing it — what it *looks
like*. If the render hasn't landed yet, the card turns anyway and asks for it on
the spot, which also quietly repairs anything saved before the feature existed.

### The trial room

The dashboard, and the app's home. Four slots — top, bottom, shoes, layer — and
two hands of cards fanned into the bottom corners. Fill the slots, build the fit.

The room is lit by what you pick: each garment lends its *hue* to one of four
panels, so a green tee and a blue jacket put green in one corner and blue in
another. It's the garment's hue, not its darkness — a bottle-green tee used
straight would light the room mud-brown.

The wardrobe and the trial room are two halves of one sliding surface. One
transform, two rooms, no gap.

### The browser extension

On any shop's product page: read the garment, tell you what size fits, try it on
your body, save it to your wardrobe. Works by structure rather than a
hardcoded site list, so it isn't limited to shops we've heard of.

### Onboarding

Three steps — who you are, your measurements, a body to dress — ordered by
consequence rather than effort. Done-ness is **derived from the account, never a
stored flag**: delete your only avatar and the body step comes back, because a
flag would still claim you were set up while every try-on silently failed.

---

## The hard parts

Most of this product is a handful of problems that look easy from the outside
and are not. What follows is what actually went wrong, and what we did about it.

### Dressing a person four times gives you four different people

The obvious way to layer an outfit is one API call per garment, chained: shirt,
then trousers, then jacket. It produced two bugs we could not design around.

The person **drifted** — every call regenerates the whole photograph, face
included, so by the fourth layer it was somebody else. And the jacket **erased
the tee underneath it**, because `upper_body` means *replace the upper body*,
and the engine helpfully painted in a white shirt where the tee had been.

So we stopped chaining. Every piece is composited onto a single reference sheet
server-side, and the whole outfit goes on in **one `full_body` call**. Nothing
renders twice, so nothing can drift — and a four-piece fit went from four
thirty-second renders to one.

Shoes are the deliberate exception. On a full sheet they are a small object
under a lot of clothes and the engine read a trainer as a pair of slides, so
they keep their own call — through the *cloth* model, not `/task/shoes`, which
re-renders the room as well and returned people standing somewhere else.

### We chose the segmentation model by measuring, not by reading

The background remover is the difference between a wardrobe and a folder of bad
photos. So we benchmarked candidates on **our own uploads** rather than trusting
DUTS and DIS scores, and built a harness that stays in the repo so the decision
can be re-checked rather than believed.

The result was counter-intuitive and we took it anyway: **u2netp, at 4.4MB**,
agrees with u2net (168MB) and silueta (42MB) to within **0.012 IoU** and fails on
exactly the same images. It ships inside the repo — no fetch step, no cache
directory, no cold-start download — and it fits in a serverless function, which
a 168MB model does not.

We rejected the more accurate options for stated reasons: BiRefNet-lite is
better at hair and garments do not have hair; RMBG-2.0 is the most accurate of
the family and its licence forbids commercial use. **MODNet was the interesting
one** — it beat our choice on photographs of people, then punched holes straight
through folded trousers, because it is portrait-trained and a folded leg reads
as the gap between two limbs. Its *average* score stayed respectable while doing
it, which is exactly why we looked at the pictures and not just the number.

### Your measurements never enter a shop's page

The extension needs a size chart from the page and your body to compare it
against — and a content script shares its world with every script the shop
loads. Anything ours can read, theirs can.

So the split is absolute: **the extension only scrapes, the server only
decides.** Raw table cells go up — all of it already public on the page — and a
letter comes back. The body stays on our side of the wire. We also don't click
"size guide" buttons to reveal hidden charts; silently opening a shop's modals
on someone's behalf isn't ours to do.

The same instinct shapes the cutout: photographs are matted **in the browser**,
and only a ~320px probe is posted for the model to look at. Your 12MB phone
photo never leaves your machine.

### Two matte implementations, one contract

The model and the hand-written flood fill both return one byte per pixel, `1`
for background — deliberately identical, so no caller can tell which answered.
That single decision is what makes every failure path a graceful one: no
runtime, no weights, an undecodable image, a model that returns something
implausible — each falls back silently to an algorithm that needs nothing.

A wardrobe that cuts garments out slightly worse is still a wardrobe. One that
throws because a native module is missing is not.

### The details that only bite in production

- **`onnxruntime-node` is pinned to an exact `1.23.2`.** 1.24.3 dropped the
  `darwin-x64` binary — the module still resolves, the binary just isn't there,
  and inference silently degrades on every Intel Mac.
- **The model and its weights are named in `outputFileTracingIncludes`.** They
  are reached through `createRequire` and a runtime path, so Next's tracer
  cannot see them: the build worked, and the deploy would have shipped a
  function with no model in it — working perfectly in dev, silently falling back
  in production, with nobody told.
- **Try-on renders take ~30 seconds**, so every control that triggers one has a
  real loading state. Nothing in this app is optimistic about someone else's GPU.

---

## The pieces

```
rangrez/
├─ apps/web         Next.js 16 (App Router) · React 19 · Tailwind v4 · Supabase
└─ apps/extension   Chrome MV3 content script + panel
```

| Route | What it is |
|---|---|
| `/` | Landing page |
| `/auth` · `/verify` · `/onboarding` | Sign in, confirm, first run |
| `/wardrobe` | The cupboard, and the trial room a slide away |
| `/look` | The trial room on its own |
| `/avatars` · `/atelier` | Your bodies; shooting a new one |
| `/profile` | Identity, measurements, colour season, preferences |
| `/connect` | Pair the extension |

---

## Design and UX

### Neubrutalism

Flat colour, 3px black borders, hard offset shadows, no gradients and no
texture. Three primaries on cream:

| Token | Value | Used for |
|---|---|---|
| `brass` | `#FFDE59` | the primary — brand block, active tab, buttons |
| `madder` | `#FF5252` | the accent — current tab underscore, destructive |
| `indigo` | `#2196F3` | the cool note |
| `abyss` | `#12100D` | every border and rule in the app |

The palette lives in one `@theme` block, so components read tokens rather than
hex. Buttons are the clearest statement of the language: a slab that sits on its
shadow, and **pressing it moves it into the shadow** rather than tinting it.

### Type

- **Inter Tight 800** — display
- **JetBrains Mono** — spec lines, labels, indices
- **Clash Display, Instrument Serif, Identity, Friday Night Lights, Iosevka** —
  the landing page and the garment card, which are posters rather than interface

The garment card's two local faces are drawn far outside their em box, which is
the whole reason it looks the way it does — Identity's letterforms are filled
with fingerprint whorls, so the texture behind a garment is *typeset*, not an
image.

### Motion, and the rules it follows

- **The slide between rooms** is one compositor-only transform on a track
  carrying both rooms. Not a crossfade — a crossfade between two rooms on the
  same background reads as a flicker, not as movement.
- **The card turn** is a rotation, because the cutout and the render are two
  sides of one object rather than two states of one image.
- **Hanging garments** swing on an underdamped spring. Cloth overshoots before
  it settles; critical damping reads as an animation, not as weight.
- **The tapes** repeat their text and travel exactly one repeat, so the frame
  they land on is identical to the one they left and the loop is invisible.
- Everything honours `prefers-reduced-motion`.

### Principles worth stating

**One viewport, no page scroll.** Every interface screen fits once. The rails
scroll sideways, the way you actually push coats along a rail.

**A render takes ~30 seconds, so nothing pretends otherwise.** Every
VTO-triggering control has a real loading state; nothing is optimistic about
someone else's GPU.

**Degrade, never fail.** A missing model falls back to the hand-written matte. A
failed try-on leaves the cutout. A body too busy to matte cleanly falls back to
the photograph. A wardrobe that cuts garments out slightly worse is still a
wardrobe.

---

## YouCam (Perfect Corp) API

All of it lives in **`apps/web/lib/youcam.ts`** — the only file that knows about
access tokens, file handles or task polling. Callers get promises that resolve
to image URLs.

Base: `https://yce-api-01.perfectcorp.com` (`YOUCAM_API_BASE`)

### The call sequence

```
1. POST /s2s/v1.0/client/auth          → result.access_token
2. POST /s2s/v1.0/file/{feature}       → result.files[0].{file_id, requests[0]}
3. PUT  <pre-signed S3 target>         → the image bytes
4. POST /s2s/v2.0/task/{feature}       → data.task_id            ← async
5. GET  /s2s/v2.0/task/{feature}/{id}  → data.{task_status, results}
```

Auth is an **RSA-signed id_token** exchanged for a bearer access token, built
from `YOUCAM_API_KEY` + `YOUCAM_SECRET_KEY`.

### Details that cost us time

- **The version split is real.** Files are `v1.0`, tasks are `v2.0`.
- **The v2.0 task body is flat** — `{src_file_id, ref_file_id, garment_category}` —
  not the nested `payload`/`file_sets`/`actions` envelope of the older endpoints.
- **Responses key differently:** task responses off `data`, file responses off
  `result`.
- **Polling is a path segment, not a query string.** `GET` on the bare task path
  returns 405.
- **Apparel VTO never returns an image inline.** Always async, always polled.

### Surfaces

| Target | Endpoint family |
|---|---|
| `upper_body`, `lower_body`, `full_body` | cloth |
| `shoes` | **cloth**, not `/task/shoes` |
| `bag`, `hat` | own features, take `gender` |
| `necklace`, `earring`, `ring`, `bracelet`, `watch` | jewellery — array of refs, and a `name` on the source *and* each object, or the request is rejected |

**Shoes deliberately go through the cloth model.** `/task/shoes` works, but it
re-renders the figure *and the room around it* — a fit three layers deep came
back as somebody else standing somewhere else.

### A whole outfit in one render

The whole outfit goes on in a single `full_body` call against one composited
reference sheet, rather than one call per layer — chaining made the face drift
and let a jacket erase the tee beneath it. Shoes keep their own call. The full
account is in [The hard parts](#dressing-a-person-four-times-gives-you-four-different-people).

### Mock mode

With `YOUCAM_MOCK=1`, or no API key set, every call is faked with a
plausible, correctly-shaped, correctly-*delayed* response. The product stays
fully clickable before a key lands, and demos don't burn credits.

---

## Cutting the garment out

Two implementations behind one contract — one byte per pixel, **1 for
background** — so callers can't tell which answered.

**1 · `lib/segment.ts` — U²-Net lite (u2netp), 4.4MB, Apache-2.0.**
Chosen by measurement, not reputation: against u2net (168MB) and silueta (42MB)
on our own uploads, all three agree within **0.012 IoU** and fail on the same
images. 4.4MB ships in the repo and needs no fetch step, no cache directory and
no cold-start download. `scripts/bench-matte.mjs` exists so the claim can be
re-checked rather than believed.

Rejected, with reasons: **BiRefNet-lite** (224MB, fixed 1024², better at hair —
garments don't have hair), **RMBG-2.0/1.4** (most accurate, licence forbids
commercial use), **MODNet** (beats u2netp on people, then punches holes straight
through garments — it's portrait-trained, and a folded trouser leg reads as the
gap between two limbs).

> `onnxruntime-node` is pinned to an exact **1.23.2**. Do not widen it — 1.24.3
> dropped the `darwin-x64` binary, which makes this silently unrunnable on an
> Intel Mac.

**2 · `lib/matte.ts` — connectivity flood fill.** No dependencies, so it is the
half that can be tested. Good on a product sweep; on a photograph of a shirt on
a bedroom floor it keeps most of the frame, because a forest is not one colour.
It's the fallback, not the plan.

The browser cuts in the browser and the photograph never leaves the machine —
only a ~320px probe is posted to `/api/matte`, and the returned mask is applied
locally at full resolution.

---

## Does it fit?

Your measurements are entered **once** and checked against the size chart on
every product page you open.

The privacy split is deliberate and load-bearing: the content script **only
scrapes** — raw table cells and size labels, all of it already public on the
page — and the **server decides**. The body never enters a shop's page, where
any script the shop loads could read anything ours could. We send up a chart
that was already public and get back a letter.

The extension doesn't click "size guide" links. Silently opening a shop's modals
on someone's behalf isn't ours to do; we read what's already in the DOM, and
fall back to standard sizing when there's nothing, saying so.

---

## Running it

```bash
npm install
npm run dev
```

`apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=

# Leave YOUCAM_MOCK=1 until a key lands — everything stays clickable.
YOUCAM_MOCK=1
YOUCAM_API_KEY=
YOUCAM_SECRET_KEY=

# RANGREZ_MATTE=classic forces the hand-written matte.
```

Migrations in `apps/web/supabase/`, applied in order. Full setup and deployment
notes are in [RUNNING.md](RUNNING.md); the product spec is in
[apps/web/RANGREZ.md](apps/web/RANGREZ.md).

```bash
node --test 'apps/extension/test/*.test.mjs'   # 90 tests
```

---

## Repository layout

```
apps/web/
  app/            routes and API handlers
  components/     Landing, Closet, LookCreator, GarmentPlate, GarmentFlip, …
  lib/
    youcam.ts       the only file that talks to Perfect Corp
    segment.ts      U²-Net runner
    matte.ts        flood fill — no imports, fully tested
    garment-cut.ts  photograph → cutout → reference sheet
    fit.ts          size charts, measurements, recommendations
    tint.ts         a garment's dye → its card's palette
  models/         u2netp.onnx (4.4MB, shipped)
  scripts/        bench-matte.mjs — the model comparison harness

apps/extension/
  src/content/    detect.js · sizing.js · panel.js
  test/           the suite for both apps
```
