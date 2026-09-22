-- 0004_functions_and_triggers.sql
-- Membership helper used by every RLS policy, updated_at triggers, and the
-- recurrence roll-forward used when a recurring item is marked done.

-- ---------------------------------------------------------------------------
-- is_household_member: the single authorization predicate for the whole app.
-- SECURITY DEFINER so that reading household_members from inside a policy on
-- household_members does not recurse.
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
      from public.household_members hm
     where hm.household_id = p_household_id
       and hm.user_id = auth.uid()
       and hm.deleted_at is null
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

-- Cast a storage folder name to uuid without blowing up on junk paths.
create or replace function public.safe_uuid(p_text text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'households', 'household_members', 'household_invites', 'items',
    'item_completions', 'patients', 'providers', 'insurance_plans',
    'medical_bills', 'eobs', 'bill_eob_links', 'bill_activity', 'documents'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Recurrence: the next due date strictly after p_from.
-- ---------------------------------------------------------------------------
create or replace function public.next_due_date(
  p_due      date,
  p_rec      public.recurrence_type,
  p_interval integer default null,
  p_unit     public.recurrence_unit default null,
  p_from     date default current_date
)
returns date
language plpgsql
immutable
as $$
declare
  v_next date := p_due;
  v_step interval;
begin
  v_step := case p_rec
    when 'monthly'    then interval '1 month'
    when 'quarterly'  then interval '3 months'
    when 'semiannual' then interval '6 months'
    when 'annual'     then interval '1 year'
    when 'custom'     then case p_unit
                             when 'day'   then make_interval(days   => coalesce(p_interval, 1))
                             when 'week'  then make_interval(weeks  => coalesce(p_interval, 1))
                             when 'month' then make_interval(months => coalesce(p_interval, 1))
                           end
    else null
  end;

  if v_step is null or v_step <= interval '0' then
    return null;
  end if;

  -- Skip past any occurrences that are already behind us, so a recurring item
  -- that was missed for months lands on the next real due date.
  loop
    v_next := (v_next + v_step)::date;
    exit when v_next > p_from;
  end loop;

  return v_next;
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_item: record the completion, then either roll the due date forward
-- (recurring) or mark the item done (one-off). Runs as the caller, so RLS on
-- items still decides whether this is allowed.
-- ---------------------------------------------------------------------------
create or replace function public.complete_item(
  p_item_id      uuid,
  p_completed_on date default current_date,
  p_amount_paid  numeric default null,
  p_note         text default null
)
returns public.items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.items;
  v_next date;
begin
  select * into v_item from public.items where id = p_item_id and deleted_at is null;
  if not found then
    raise exception 'item % not found', p_item_id;
  end if;

  insert into public.item_completions (
    household_id, item_id, completed_on, due_date, amount_paid, note, created_by
  ) values (
    v_item.household_id, v_item.id, coalesce(p_completed_on, current_date),
    v_item.due_date, p_amount_paid, p_note, auth.uid()
  );

  if v_item.recurrence = 'none' then
    update public.items
       set status = 'done'
     where id = v_item.id
    returning * into v_item;
  else
    v_next := public.next_due_date(
      v_item.due_date, v_item.recurrence, v_item.recurrence_interval,
      v_item.recurrence_unit, coalesce(p_completed_on, current_date)
    );
    update public.items
       set due_date = coalesce(v_next, v_item.due_date),
           status   = 'upcoming'
     where id = v_item.id
    returning * into v_item;
  end if;

  return v_item;
end;
$$;

grant execute on function public.complete_item(uuid, date, numeric, text) to authenticated;
grant execute on function public.next_due_date(date, public.recurrence_type, integer, public.recurrence_unit, date) to authenticated;
