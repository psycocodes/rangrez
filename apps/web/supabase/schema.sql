-- ═══════════════════════════════════════════════════════════════════════════
--  RANGREZ · Supabase schema
--  Paste into the Supabase SQL editor and run. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  A note on access control, because it matters here:
--
--  Rangrez authenticates with its own signed cookie, not Supabase Auth, so
--  there is no `auth.uid()` for a row policy to key off. That leaves exactly
--  one safe arrangement: RLS on, no policies for the anon/publishable role,
--  and all access from the server using the SECRET (service_role) key, which
--  bypasses RLS. Every query in lib/db.ts scopes by user_id itself.
--
--  The upshot: the publishable key in NEXT_PUBLIC_* can read nothing. That is
--  deliberate — it ships to the browser.
--
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── users ─────────────────────────────────────────────────────────────────
create table if not exists rangrez_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text not null,
  password_hash text not null,
  avatar        jsonb,
  preferences   jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ── the catalog ───────────────────────────────────────────────────────────
create table if not exists rangrez_garments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references rangrez_users(id) on delete cascade,
  name        text not null,
  -- closet | shop | seed. 'shop' is what the extension saves, which is what
  -- the wardrobe's "From a shop" filter keys off.
  origin      text not null default 'closet',
  zone        text not null,
  dye         jsonb not null,
  season      text not null default 'yearround',
  material    text not null default '',
  image_url   text not null,
  seed        text not null default '',
  status      text not null default 'rendered',
  task_id     text,
  in_palette  boolean not null default false,
  worn_count  integer not null default 0,
  -- where a shop item was found, so the card can link back to it
  source_url  text,
  added_at    timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists rangrez_garments_user_added_idx
  on rangrez_garments (user_id, added_at desc);
create index if not exists rangrez_garments_user_origin_idx
  on rangrez_garments (user_id, origin);

-- ── saved combinations ────────────────────────────────────────────────────
create table if not exists rangrez_fits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references rangrez_users(id) on delete cascade,
  name        text not null,
  garment_ids jsonb not null default '[]'::jsonb,
  note        text,
  saved_at    timestamptz not null default now()
);

create index if not exists rangrez_fits_user_saved_idx
  on rangrez_fits (user_id, saved_at desc);

-- ── keep updated_at honest ────────────────────────────────────────────────
create or replace function rangrez_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists rangrez_garments_touch on rangrez_garments;
create trigger rangrez_garments_touch
  before update on rangrez_garments
  for each row execute function rangrez_touch_updated_at();

-- ── lock it down ──────────────────────────────────────────────────────────
-- RLS on with no policies = the publishable key can do nothing at all.
-- The server uses the secret key, which bypasses RLS entirely.
alter table rangrez_users    enable row level security;
alter table rangrez_garments enable row level security;
alter table rangrez_fits     enable row level security;

revoke all on rangrez_users, rangrez_garments, rangrez_fits from anon, authenticated;
