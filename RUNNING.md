# Running & deploying Rangrez

Two pieces: the **web app** (`apps/web`, Next.js) and the **browser extension**
(`apps/extension`, Chrome + Firefox from one source tree). They talk over three
bearer-token endpoints.

---

## 1 · First run, locally

### a. Install

```bash
npm install
```

> The repo pins npm 11.8.0 in `devEngines`; that's now a warning rather than a
> hard failure, so 11.3+ installs fine.

### b. Set up Supabase

Create a project, then in **SQL Editor** run, in order:

1. [`apps/web/supabase/schema.sql`](apps/web/supabase/schema.sql) — tables
2. [`apps/web/supabase/002-supabase-auth.sql`](apps/web/supabase/002-supabase-auth.sql) — ties
   profiles to `auth.users` and adds row policies
3. [`apps/web/supabase/003-avatars-and-uploads.sql`](apps/web/supabase/003-avatars-and-uploads.sql)
   — up to three avatar plates per account, and the second image a garment
   carries (the piece worn, as opposed to the piece)

All three are idempotent. **Migration 002 truncates the tables** — old accounts
can't be carried across, because Supabase has to hash the passwords and we only
ever stored a digest. **003 drops nothing** and backfills existing avatars into
the new list, so it is safe to run on a database already in use.

Until 003 has run, the app still reads fine but every write that touches an
avatar or an upload fails and routes you to `/setup` — the columns simply
aren't there yet.

Then, under **Authentication → Sign In / Providers**, turn **Confirm email**
off for development. Left on, sign-up sends a link and creates no session, so
you can't get into the app without clicking through your inbox first. The app
handles this and says so, but it's friction you don't want while building.

Then fill in `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SECRET_KEY=<Project Settings → API keys → secret>
```

Accounts live in Supabase Auth, so they show up in the **Authentication** tab
and Supabase owns password hashing and session refresh. `rangrez_users` holds
only the profile — display name, avatar plate, colour season, preferences —
keyed to `auth.users.id`.

Both keys are needed. The publishable key carries the signed-in user's session
(row policies scope them to their own rows); the secret key is for the
extension's bearer-token endpoints, which have no cookie to speak with.

### b2. Sign in with Google (optional)

Nothing about Google goes in this repo or its env — Supabase holds the
credentials and the app only asks it where to send the browser. The button on
the door appears on its own once the provider is switched on, and stays hidden
until then, because a disabled provider sends people to a raw JSON error page
with no way back.

**1 · Google Cloud Console** → <https://console.cloud.google.com>

- *APIs & Services → OAuth consent screen*: External, app name "Rangrez",
  your email for support and developer contact. Default scopes are enough
  (`openid`, `userinfo.email`, `userinfo.profile`).
- *Credentials → Create credentials → OAuth client ID → Web application*
- **Authorised redirect URI** — this one exactly, and it is the Supabase
  domain, not yours:

  ```
  https://kxulzyngjuivxsqypfti.supabase.co/auth/v1/callback
  ```

- Copy the **Client ID** and **Client secret**.

**2 · Supabase** → *Authentication → Sign In / Providers → Google*

- Enable it, paste the Client ID and Client secret, save.

**3 · Supabase** → *Authentication → URL Configuration*

- **Site URL**: `http://localhost:3000` (swap for your domain in production)
- **Redirect URLs**: add both

  ```
  http://localhost:3000/auth/callback
  https://your-domain.com/auth/callback
  ```

While the consent screen is in *Testing*, only accounts listed under **Audience
→ Test users** can sign in. Publish it, or add your own address there.

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

**Chrome** — no build step:

1. `chrome://extensions` → **Developer mode** on
2. **Load unpacked** → `apps/extension`

**Firefox** — one command first:

```bash
node apps/extension/build.mjs
```

1. `about:debugging` → **This Firefox** → **Load Temporary Add-on**
2. Pick `apps/extension/dist/firefox/manifest.json`
3. Open the Rangrez popup → **Grant site access**. Firefox makes MV3 host
   permissions opt-in, so nothing injects until you allow it.

Then, either browser:

4. Visit <http://localhost:3000/connect> while signed in — the extension lifts
   its key off that page. Nothing to copy.
5. Open any clothing product page.

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
| `node apps/extension/test/logic.test.mjs` | classification + CDN rewrites (40 assertions) |
| `node apps/extension/test/score.test.mjs` | image-picking, incl. the fabric-macro trap |
| `node apps/extension/build.mjs` | lay out `dist/chrome` + `dist/firefox` |
| `npx web-ext lint --source-dir apps/extension/dist/firefox` | Mozilla's own validator |
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

Chrome needs no build step — the folder *is* the extension. Firefox needs
`node apps/extension/build.mjs`, which lays the same `src/` and `assets/` next
to an event-page manifest. Two edits before either works against a deployed
app:

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

Then either keep loading it unpacked, or package both stores at once:

```bash
node apps/extension/build.mjs --zip
# → dist/rangrez-chrome.zip   → Chrome Web Store dashboard
# → dist/rangrez-firefox.zip  → addons.mozilla.org
```

`test/` and `dist/` never ship. The Firefox build passes `web-ext lint` with
zero errors; the twelve `UNSAFE_VAR_ASSIGNMENT` warnings are the linter unable
to see through the `esc()` helper every interpolation goes through — worth a
note in the AMO review comments.

Two more things worth pre-empting in a store review: the broad `host_permissions`
exist so the background can fetch garment images from arbitrary shop CDNs, and
the content script runs on all sites because clothing stores are not a knowable
list — it stays inert unless the page is a product page *and* the classifier
recognises a garment.

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
  supabase/*.sql             tables, auth wiring, row policies
  lib/auth.ts                Supabase Auth session → profile

apps/extension               MV3 · Chrome + Firefox, one source
  manifest.json              Chrome (service worker)
  manifest.firefox.json      Firefox (event page + gecko id)
  build.mjs                  lays both out into dist/
  src/lib/api.js             browser ?? chrome — the whole port, one line
  src/background.js          token · API · image fetch · pixel analysis
  src/lib/score.js           candidate scoring, pure and unit-tested
  src/content/               detect → panel → orchestration
  src/lib/taxonomy.js        what is this garment
  src/lib/sites.js           per-platform selectors + CDN rewrites
```

Seams worth knowing: **Sign in with Google** is `signInWithOAuth({ provider:
"google" })` plus a callback route — `getCurrentUser()` already reads whatever
session Supabase has, so nothing downstream changes. Swapping the database
means reimplementing `lib/db.ts` and nothing else.
