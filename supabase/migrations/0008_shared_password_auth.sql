-- 0008_shared_password_auth.sql
--
-- Switches the app from magic-link email sign-in to a single shared password.
--
-- That makes two things different, which were the same thing before:
--
--   * WHO CAN OPEN THE APP  -> public.household_users (new). One row per
--     Supabase auth account. With a shared login there is exactly one.
--   * WHO IS RESPONSIBLE    -> public.household_members. These are now plain
--     people records ("Scott", "Spouse") used for an item's owner field. They
--     no longer have a login attached.
--
-- Run this after 0001-0007. It is idempotent and safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. household_users: the login <-> household link
-- ---------------------------------------------------------------------------
create table if not exists public.household_users (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  unique (household_id, user_id)
);

create index if not exists household_users_user_idx
  on public.household_users (user_id);

drop trigger if exists set_updated_at on public.household_users;
create trigger set_updated_at before update on public.household_users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Carry over any account that already signed in, BEFORE the old link
--    column is removed. Without this, an existing household would be
--    orphaned the moment authorization stops reading household_members.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'household_members'
       and column_name  = 'user_id'
  ) then
    execute $q$
      insert into public.household_users (household_id, user_id, created_by)
      select hm.household_id, hm.user_id, hm.user_id
        from public.household_members hm
       where hm.user_id is not null
      on conflict (household_id, user_id) do nothing
    $q$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Authorization now reads household_users. Still SECURITY DEFINER, so the
--    policy on household_users can query it without recursing.
-- ---------------------------------------------------------------------------
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.household_users hu
     where hu.household_id = p_household_id
       and hu.user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS on household_users. Readable by the household; rows are created only
--    by bootstrap_household(), so there is deliberately no INSERT policy.
-- ---------------------------------------------------------------------------
alter table public.household_users enable row level security;

drop policy if exists household_users_select on public.household_users;
create policy household_users_select on public.household_users
  for select to authenticated
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- 5. household_members becomes a plain list of people.
--    The old delete policy referenced user_id, so it goes first.
-- ---------------------------------------------------------------------------
drop policy if exists household_members_delete on public.household_members;

alter table public.household_members drop column if exists user_id;
alter table public.household_members alter column email drop not null;

-- People are now added and removed freely from Settings.
drop policy if exists household_members_insert on public.household_members;
create policy household_members_insert on public.household_members
  for insert to authenticated
  with check (public.is_household_member(household_id));

create policy household_members_delete on public.household_members
  for delete to authenticated
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- 6. Email invites are gone along with email sign-in.
-- ---------------------------------------------------------------------------
drop table if exists public.household_invites cascade;

-- ---------------------------------------------------------------------------
-- 7. bootstrap_household: no invite branch. First sign-in on the shared
--    account creates the household, links the account, adds two people, and
--    seeds the starter data.
--
--    A second, unrecognised account deliberately gets its OWN household
--    rather than joining an existing one — so that if signups are ever left
--    open by accident, a stranger lands in an empty household instead of
--    yours. To attach a second login on purpose, see the note at the bottom.
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_household()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_email     text;
  v_household uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select hu.household_id into v_household
    from public.household_users hu
   where hu.user_id = v_user
   order by hu.created_at
   limit 1;

  if v_household is not null then
    return v_household;
  end if;

  select u.email into v_email from auth.users u where u.id = v_user;

  insert into public.households (name, created_by)
  values ('Our Household', v_user)
  returning id into v_household;

  insert into public.household_users (household_id, user_id, created_by)
  values (v_household, v_user, v_user);

  -- The first person is inserted before seeding: seed_household_starter_data()
  -- names the first patient after the earliest member row.
  insert into public.household_members (household_id, display_name, email, role, created_by)
  values (v_household, initcap(split_part(coalesce(v_email, 'me@local'), '@', 1)),
          v_email, 'owner', v_user);

  perform public.seed_household_starter_data(v_household);

  insert into public.household_members (household_id, display_name, role, created_by)
  values (v_household, 'Spouse', 'member', v_user);

  return v_household;
end;
$$;

revoke all on function public.bootstrap_household() from public;
grant execute on function public.bootstrap_household() to authenticated;

-- ---------------------------------------------------------------------------
-- Adding a second login to an EXISTING household, on purpose
-- ---------------------------------------------------------------------------
-- Create the account in Authentication -> Users, then run this once, with
-- that account's email and your household id filled in:
--
--   insert into public.household_users (household_id, user_id)
--   select h.id, u.id
--     from public.households h, auth.users u
--    where h.id = '00000000-0000-0000-0000-000000000000'
--      and lower(u.email) = lower('second-login@example.com')
--   on conflict do nothing;
--
-- Find your household id with:  select id, name from public.households;
