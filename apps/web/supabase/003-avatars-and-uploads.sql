-- ═══════════════════════════════════════════════════════════════════════════
--  RANGREZ · 003 — several plates, and clothes you upload yourself
--  Run after 002-supabase-auth.sql. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Two features land together because they touch the same two tables:
--
--    · an account may now hold up to three avatar plates, one of them active
--    · a garment may carry two images — the piece itself, and the piece worn
--
--  Nothing is dropped. `rangrez_users.avatar` stays, and the app keeps writing
--  the active plate into it, so anything still reading that column (an old
--  deploy mid-rollout, a dashboard query, a psql session) keeps working.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ── several plates ────────────────────────────────────────────────────────
alter table rangrez_users
  add column if not exists avatars jsonb not null default '[]'::jsonb;
alter table rangrez_users
  add column if not exists active_avatar_id text;

-- Backfill: the single plate people already have becomes plate one, and the
-- active one. Guarded on emptiness so re-running this cannot duplicate it.
update rangrez_users
   set avatars = jsonb_build_array(avatar)
 where avatar is not null
   and avatars = '[]'::jsonb;

update rangrez_users
   set active_avatar_id = avatar->>'id'
 where avatar is not null
   and active_avatar_id is null;

-- Three is a product decision (see MAX_AVATARS), but it is enforced here too:
-- the app is not the only thing that can write this row.
alter table rangrez_users
  drop constraint if exists rangrez_users_avatars_max;
alter table rangrez_users
  add constraint rangrez_users_avatars_max
  check (jsonb_array_length(avatars) <= 3);

-- ── the piece, and the piece worn ─────────────────────────────────────────
-- image_url is what a card shows at rest; try_on_url is what it crossfades to
-- on hover. Uploads have both, shop saves have only the render, seeds neither.
alter table rangrez_garments
  add column if not exists try_on_url text;
-- Which plate the render was made against. When someone switches plates we can
-- tell which renders are now of the wrong body.
alter table rangrez_garments
  add column if not exists try_on_avatar_id text;

-- Which YouCam surface this piece renders through. Not derivable from `zone`:
-- a watch and a bag share the accessory rail but are different endpoints.
alter table rangrez_garments
  add column if not exists vto_target text;

-- ── the source tag ────────────────────────────────────────────────────────
-- 'upload' joins closet | shop | seed. There was never a check constraint on
-- origin, so this is documentation rather than a migration — but the wardrobe
-- filter now depends on these four being the only values, so pin them.
alter table rangrez_garments
  drop constraint if exists rangrez_garments_origin;
alter table rangrez_garments
  add constraint rangrez_garments_origin
  check (origin in ('upload', 'shop', 'closet', 'seed'));

-- The wardrobe filters by source constantly; give it the index it wants.
create index if not exists rangrez_garments_user_origin_added_idx
  on rangrez_garments (user_id, origin, added_at desc);
