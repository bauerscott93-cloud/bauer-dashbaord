-- 0005_rls_policies.sql
-- Row Level Security everywhere. A user can only touch rows whose household_id
-- is a household they belong to via household_members.

-- ---------------------------------------------------------------------------
-- households: readable/updatable by members. Creation goes through the
-- bootstrap_household() RPC, so there is deliberately no INSERT policy.
-- ---------------------------------------------------------------------------
alter table public.households enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

-- ---------------------------------------------------------------------------
-- household_members: members see and manage the roster. Rows are created by
-- bootstrap_household() (first sign-in / invite acceptance) only.
-- ---------------------------------------------------------------------------
alter table public.household_members enable row level security;

drop policy if exists household_members_select on public.household_members;
create policy household_members_select on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

drop policy if exists household_members_update on public.household_members;
create policy household_members_update on public.household_members
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists household_members_delete on public.household_members;
create policy household_members_delete on public.household_members
  for delete to authenticated
  using (public.is_household_member(household_id) and user_id is distinct from auth.uid());

-- ---------------------------------------------------------------------------
-- Every remaining table gets the same four policies.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'household_invites', 'items', 'item_completions', 'patients', 'providers',
    'insurance_plans', 'medical_bills', 'eobs', 'bill_eob_links',
    'bill_activity', 'documents'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.is_household_member(household_id))', t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.is_household_member(household_id))', t || '_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.is_household_member(household_id))
         with check (public.is_household_member(household_id))', t || '_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.is_household_member(household_id))', t || '_delete', t);
  end loop;
end $$;
