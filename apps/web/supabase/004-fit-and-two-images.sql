-- ═══════════════════════════════════════════════════════════════════════════
--  RANGREZ · 004 — the garment and the garment worn, and whether it will fit
--
--  ▸ RUN THIS ONE. It contains everything 003 did, so if you never ran 003
--    this single file brings the database fully up to date. Every statement
--    is idempotent — running it twice, or running it after 003, is safe.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Three things land here.
--
--  1 · TWO IMAGES PER PIECE, and each column means exactly one thing:
--
--        image_url    the garment on its own — the cutout, what it *is*
--        try_on_url   the same garment on your avatar — what it looks like ON you
--
--      That was already the intent, but shop saves broke it: the extension
--      only ever sent back the finished render, so a piece saved off a
--      product page had the *worn* photograph sitting in image_url and
--      nothing in try_on_url. The card then crossfaded from a body shot to
--      nothing. The backfill at the bottom moves those into the right column.
--
--  2 · FIT. Measurements on the person, a size chart on the garment. This is
--      the half of the buying decision try-on cannot answer: the render shows
--      you the jacket, and only the numbers tell you whether to order the M.
--
--  3 · MULTIPLE PLATES (this was 003). Up to three avatars, one active.
--
--  Nothing is dropped. `rangrez_users.avatar` stays and is still written, so
--  anything reading the pre-003 column keeps working.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · several plates ────────────────────────────────────────────────────
alter table rangrez_users
  add column if not exists avatars jsonb not null default '[]'::jsonb;
alter table rangrez_users
  add column if not exists active_avatar_id text;

-- The single plate people already have becomes plate one, and the active one.
-- Guarded on emptiness so re-running this cannot duplicate it.
update rangrez_users
   set avatars = jsonb_build_array(avatar)
 where avatar is not null
   and avatars = '[]'::jsonb;

update rangrez_users
   set active_avatar_id = avatar->>'id'
 where avatar is not null
   and active_avatar_id is null;

-- Three is a product decision (see MAX_AVATARS), enforced here too because
-- the app is not the only thing that can write this row.
alter table rangrez_users
  drop constraint if exists rangrez_users_avatars_max;
alter table rangrez_users
  add constraint rangrez_users_avatars_max
  check (jsonb_array_length(avatars) <= 3);


-- ── 2 · the piece, and the piece worn ─────────────────────────────────────
alter table rangrez_garments
  add column if not exists try_on_url text;

-- Which plate the render was made against, so switching plates tells us which
-- renders are now of the wrong body.
alter table rangrez_garments
  add column if not exists try_on_avatar_id text;

-- Which YouCam surface this piece renders through. Not derivable from `zone`:
-- a watch and a bag share the accessory rail but are different endpoints.
alter table rangrez_garments
  add column if not exists vto_target text;

-- The untouched photograph the cutout was derived from — the raw camera roll
-- shot, or the shop's original gallery image. Kept so a cutout can be redone
-- when the extraction improves, without asking the user to re-upload.
alter table rangrez_garments
  add column if not exists original_url text;


-- ── 3 · fit ───────────────────────────────────────────────────────────────
-- The body. One object rather than nine columns because it is read and written
-- whole, always, and half of it is optional — see lib/fit.ts Measurements.
alter table rangrez_users
  add column if not exists measurements jsonb not null default '{}'::jsonb;

-- The garment's side of the same question: its cut, its stretch, and the
-- shop's size chart if the page published one. See lib/fit.ts GarmentFit.
alter table rangrez_garments
  add column if not exists fit jsonb;

-- The size actually owned or being considered, printed on the card.
alter table rangrez_garments
  add column if not exists size_label text;


-- ── 4 · the source tag ────────────────────────────────────────────────────
alter table rangrez_garments
  drop constraint if exists rangrez_garments_origin;
alter table rangrez_garments
  add constraint rangrez_garments_origin
  check (origin in ('upload', 'shop', 'closet', 'seed'));

create index if not exists rangrez_garments_user_origin_added_idx
  on rangrez_garments (user_id, origin, added_at desc);


-- ── 5 · put the shop renders in the right column ──────────────────────────
-- Before this migration the extension's save wrote the VTO render into
-- image_url, because there was nowhere else for it to go. image_url now means
-- "the garment alone", so those move across.
--
-- image_url is `not null`, so it cannot simply be emptied: it keeps the render
-- as its stand-in until a cutout exists. The card is then showing the same
-- photograph twice, which is honest — it is the only photograph we have — and
-- re-saving the piece from the extension fills in the real one.
update rangrez_garments
   set try_on_url = image_url
 where origin = 'shop'
   and try_on_url is null
   and image_url is not null;
