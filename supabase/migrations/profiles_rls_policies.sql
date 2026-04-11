-- Profiles table: this app authenticates with phone + password columns (no auth.users).
-- The browser uses the anon key, so RLS policies must allow anon (and authenticated) to
-- SELECT / INSERT / UPDATE as your UI already assumes.
--
-- Run this in Supabase → SQL Editor if password change or profile reads fail with RLS errors.

alter table public.profiles enable row level security;

-- Replace policies if you re-run this migration
drop policy if exists "profiles_select_anon" on public.profiles;
drop policy if exists "profiles_insert_anon" on public.profiles;
drop policy if exists "profiles_update_anon" on public.profiles;

create policy "profiles_select_anon"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

create policy "profiles_insert_anon"
  on public.profiles
  for insert
  to anon, authenticated
  with check (true);

create policy "profiles_update_anon"
  on public.profiles
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- Security note: anyone with your NEXT_PUBLIC_SUPABASE_ANON_KEY can read/write profiles
-- while these policies are in effect. Prefer migrating to Supabase Auth + auth.uid() policies
-- for production hardening.
