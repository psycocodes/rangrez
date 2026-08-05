# Rangrez · رنگریز

*The dyer of cloth.* An AI wardrobe and virtual try-on platform built on the YouCam (Perfect Corp) API.

One base avatar photo becomes the canvas for every garment you own or are considering buying — so a shirt
from your closet and a coat from a shop page hang on the same shoulders, in the same light.

Full product spec, design language and build state: **[RANGREZ.md](RANGREZ.md)**.

---

## Run it

```bash
npm install && cp .env.example .env.local && npm run dev
```

Open http://localhost:3000, create an account, and you land in the avatar studio.

**It works with no API key.** `YOUCAM_MOCK=1` is on by default: every YouCam call is faked with a
plausible, correctly-shaped, correctly-delayed response, so the whole product is clickable and no credits
are spent. Your uploaded photo is used as the avatar plate directly and the colour season is derived
locally (deterministic per photo, so it never changes under you mid-demo).

## Going live on YouCam

1. Put your Perfect Corp credentials in `.env.local`:
   ```
   YOUCAM_API_KEY=...
   YOUCAM_SECRET_KEY=...
   ```
2. Set `YOUCAM_MOCK=0`.

Nothing else changes. Every call lives in [`lib/youcam.ts`](lib/youcam.ts) — S2S auth (RSA id_token →
access token), file registration + upload, task dispatch, and the polling loop. Apparel VTO is
asynchronous and returns a `task_id`, never an inline image, so every VTO-triggering interaction in the UI
already has a real loading state.

## What's built

| Route | |
| --- | --- |
| `/enter` | Sign up / sign in (dummy auth) |
| `/atelier` | Avatar studio — capture guidance, upload, calibration render, colour-season analysis |
| `/wardrobe` | The dashboard — editorial catalog grid, zone/colour filters, the avatar plate |
| `/profile` | Plate customisation, colour-season override, fit preferences |

## Notable decisions

**Next.js instead of Vite + Express.** The PRD calls for React/Vite with a separate Node proxy. One
Next app gives the same React/Tailwind DX, keeps the YouCam key server-side in route handlers, and is a
single deploy target. Same architecture, one fewer process.

**Auth is deliberately disposable.** Email + password, scrypt-hashed, HMAC-signed httpOnly cookie. The app
only ever calls `getCurrentUser()` / `requireUser()` / `endSession()` from [`lib/auth.ts`](lib/auth.ts), so
swapping in Sign in with Google means reimplementing one function — no page or component changes.

**Storage is behind a seam.** [`lib/db.ts`](lib/db.ts) is a JSON file under `.data/`; uploads go to
`public/uploads/`. Both are ~10 functions wide. Postgres and S3 slot in without touching callers.

**Ranking is ours, not the API's.** YouCam tells us your skin tone; deciding which of *your* clothes
flatter it is independent logic in [`lib/palette.ts`](lib/palette.ts). It costs no API credit, which is
why re-ranking your whole wardrobe on a season override is instant.

**Every photo is dipped in its own dye.** Placeholder photography is tinted by each garment's catalogued
colour — luminosity from the image, hue from the dye, plus a weaker multiplied pass so dark dyes read
deep. A bag of unrelated stock photos therefore reads as one lookbook. Toggle `DYED / RAW` in the filter
bar to see the cloth before the vat.

## Next

Garment segmentation on upload · the swipe-to-style customizer · the Chrome extension ·
Google sign-in · Postgres.
