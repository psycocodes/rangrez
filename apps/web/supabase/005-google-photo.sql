-- ═══════════════════════════════════════════════════════════════════════════
--  RANGREZ · migration 005 — Google profile photo support
--  Paste into the Supabase SQL editor and run. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Two columns the app already writes but the schema never declared:
--
--    profile_photo_url   The user's profile picture URL (from Google OAuth
--                        or manually set). Used as the display photo across
--                        the app.
--
--    use_google_photo    Whether to prefer the Google account's picture over
--                        a custom one. Defaults to true — a Google sign-in
--                        should show Google's picture unless told otherwise.
--
-- ═══════════════════════════════════════════════════════════════════════════

alter table rangrez_users
  add column if not exists profile_photo_url text;

alter table rangrez_users
  add column if not exists use_google_photo boolean not null default true;
