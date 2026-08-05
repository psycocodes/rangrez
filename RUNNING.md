# Running & deploying Rangrez

Two pieces: the **web app** (`apps/web`, Next.js) and the **Chrome extension**
(`apps/extension`, no build step). They talk over three bearer-token endpoints.

---

## 1 · First run, locally

### a. Install

```bash
npm install
```

> The repo pins npm 11.8.0 in `devEngines`; that's now a warning rather than a
> hard failure, so 11.3+ installs fine.

### b. Set up Supabase

Create a project, then in **SQL Editor** paste and run
[`apps/web/supabase/schema.sql`](apps/web/supabase/schema.sql). It's idempotent.

Then fill in `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SECRET_KEY=<Project Settings → API keys → secret>
```

**The secret key is not optional.** Rangrez authenticates with its own signed
cookie, not Supabase Auth, so there's no `auth.uid()` for a row policy to key
off. The schema therefore runs RLS with no anon policies and the server holds
the secret key. The publishable key ships to the browser and can read nothing —
which is the point.

### c. YouCam

```bash
YOUCAM_API_KEY=<Perfect Corp API key>
YOUCAM_SECRET_KEY=<the RSA public key string>
YOUCAM_MOCK=0          # 1 = simulate renders, spend no credits
SESSION_SECRET=$(openssl rand -hex 32)
```

With `YOUCAM_MOCK=1` every call is faked with correctly-shaped, correctly-delayed
responses, so the whole product is clickable without a key or any credit spend.

### d. Start it

```bash
npm run dev --workspace rangrez
```

<http://localhost:3000>. If anything's missing you land on `/setup`, which tells
you which step you're on rather than throwing a stack trace.

> **Always run the workspace's own binary.** `apps/docs` pins Next 16.2 and it
> hoists to the repo root, so a bare `npx next build` from `apps/web` picks up
> the wrong version and fails on `/_not-found`. `npm run … --workspace rangrez`
> and `apps/web/node_modules/.bin/next` are both correct.

### e. Load the extension

1. `chrome://extensions` → **Developer mode** on
2. **Load unpacked** → `apps/extension`
3. Visit <http://localhost:3000/connect> while signed in — the extension lifts
   its key off that page. Nothing to copy.
4. Open any clothing product page.

### f. Migrating an older local wardrobe

```bash
node apps/web/scripts/migrate-json-to-supabase.mjs
```

Moves anything left in `apps/web/.data/db.json` — users, avatars, colour
seasons, catalog — into Supabase. Idempotent (upserts by id).

---

## 2 · Everyday commands

| | |
| --- | --- |
| `npm run dev --workspace rangrez` | web app on :3000 |
| `apps/web/node_modules/.bin/next build` | production build |
| `node apps/extension/test/logic.test.mjs` | extension unit tests (40 assertions) |
| `apps/web/node_modules/.bin/tsc --noEmit` | typecheck |
| serve `apps/extension` + open `test/harness.html` | every panel state, no install |

---

## 3 · Deploying the web app

Vercel, from the repo root (`apps/web/vercel.json` already sets the framework):

```bash
vercel --cwd apps/web
```

Or connect the repo in the dashboard with **root directory** `apps/web`.

Set these in **Project → Settings → Environment Variables**:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | same project as local |
| `SUPABASE_SECRET_KEY` | **server-side only** — never the publishable key |
| `YOUCAM_API_KEY` / `YOUCAM_SECRET_KEY` | |
| `YOUCAM_MOCK` | `0` |
| `SESSION_SECRET` | a *different* long random string from local |

Two things that bite:

- **Uploads.** Avatar photos currently land in `public/uploads/`, which is
  ephemeral on Vercel — an avatar uploaded on one instance won't exist on the
  next. Before real users, move `lib/uploads.ts` to Supabase Storage; it is two
  functions wide and nothing else touches the filesystem.
- **`maxDuration`.** `/api/extension/tryon` declares 120s. Hobby plans cap at
  60s; a slow render will be cut off. Pro or a queue fixes it.

---

## 4 · Deploying the extension

The extension has no build step — the folder *is* the extension. Two edits
before it works against a deployed app:

**`apps/extension/manifest.json`** — add your origin to the *pairing* content
script (the second entry). It trusts localhost only by default, deliberately: it
reads a bearer token off the page, and a shared wildcard like `*.vercel.app`
would let any other tenant hand your extension somebody else's token.

```jsonc
{
  "matches": [
    "http://localhost/*",
    "http://127.0.0.1/*",
    "https://rangrez.yourdomain.com/*"   // ← yours
  ],
  "js": ["src/pair.js"]
}
```

**`apps/extension/src/background.js`** — change `DEFAULT_API` to your deployed
origin (or just visit `/connect` there once; pairing stores the origin it came
from, so this only affects a fresh install that has never paired).

Then either keep using **Load unpacked**, or package it:

```bash
cd apps/extension && zip -r ../rangrez-extension.zip . -x '*.DS_Store' 'test/*'
```

`test/` is excluded because nothing in it ships. Upload the zip to the Chrome
Web Store dashboard. Review notes worth pre-empting: the broad `host_permissions`
exist so the service worker can fetch garment images from arbitrary shop CDNs,
and the content script runs on all sites because clothing stores are not a
knowable list — it stays inert unless the page is a product page *and* the
classifier recognises a garment.

---

## 5 · Shape of the thing

```
apps/web                     Next 16 · App Router
  app/(shell)/wardrobe       the grid, filters, ⋯ menu, editor
  app/(shell)/atelier        avatar studio
  app/(shell)/profile        plate, colour season, fit model
  app/(shell)/connect        extension pairing
  app/setup                  the "you haven't run the schema" gate
  app/api/extension/*        session · tryon · save   (bearer token)
  lib/youcam.ts              the only file that talks to Perfect Corp
  lib/db.ts                  the only file that talks to Supabase
  lib/palette.ts             colour-season ranking (ours, not theirs)
  supabase/schema.sql        tables + RLS

apps/extension               MV3 · no build step
  src/background.js          token · API · image fetch · pixel analysis
  src/content/               detect → panel → orchestration
  src/lib/taxonomy.js        what is this garment
  src/lib/sites.js           per-platform selectors + CDN rewrites
```

Two seams worth knowing: swapping auth for Sign in with Google means
reimplementing `getCurrentUser()` in `lib/auth.ts` and nothing else; swapping
the database means reimplementing `lib/db.ts` and nothing else.
