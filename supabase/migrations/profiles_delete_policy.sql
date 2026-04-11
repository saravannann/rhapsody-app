-- Allow anon/authenticated clients to delete profile rows (User Management → Delete user).
-- Matches open SELECT/INSERT/UPDATE policies in profiles_rls_policies.sql.

drop policy if exists "profiles_delete_anon" on public.profiles;

create policy "profiles_delete_anon"
  on public.profiles
  for delete
  to anon, authenticated
  using (true);
