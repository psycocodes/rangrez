-- ═══════════════════════════════════════════════════════════════════════════
--  RANGREZ · migration 002 — move accounts to Supabase Auth
--  Paste into the Supabase SQL editor and run. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Before: `rangrez_users` held its own email + scrypt password_hash, and
--  accounts were invisible in the Authentication tab.
--
--  After: `auth.users` owns the account and the credentials. `rangrez_users`
--  keeps only the profile — display name, avatar plate, colour season,
--  preferences — keyed by the auth user's id.
--
--  Because there is now a real `auth.uid()`, the tables get proper row
--  policies as well: a signed-in user can reach their own rows and nobody
--  else's, even with the publishable key. The server still uses the secret
--  key, which bypasses RLS, for the extension's bearer-token endpoints.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- Old accounts can't be carried over: Supabase must hash the passwords, and we
-- only ever stored the digest. Anyone from before signs up again.
truncate table rangrez_fits, rangrez_garments, rangrez_users cascade;

alter table rangrez_users drop column if exists password_hash;

-- Tie the profile to the auth account, so deleting a user in the
-- Authentication tab cleans up their wardrobe too.
alter table rangrez_users drop constraint if exists rangrez_users_id_fkey;
alter table rangrez_users
  add constraint rangrez_users_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- ── row policies ──────────────────────────────────────────────────────────
-- Now that auth.uid() exists, say plainly who may touch what.
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on rangrez_users, rangrez_garments, rangrez_fits
  to authenticated;

drop policy if exists "own profile" on rangrez_users;
create policy "own profile" on rangrez_users
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "own garments" on rangrez_garments;
create policy "own garments" on rangrez_garments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own fits" on rangrez_fits;
create policy "own fits" on rangrez_fits
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- anon (the publishable key with no session) still gets nothing.
revoke all on rangrez_users, rangrez_garments, rangrez_fits from anon;
