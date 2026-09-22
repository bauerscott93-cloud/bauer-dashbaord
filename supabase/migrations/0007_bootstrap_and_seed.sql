-- 0007_bootstrap_and_seed.sql
-- First sign-in: join an invited household or create one and fill it with the
-- starter items so the app is never empty.

create or replace function public.next_annual_date(
  p_month integer,
  p_day   integer,
  p_from  date default current_date
)
returns date
language sql
stable
as $$
  select case
    when make_date(extract(year from p_from)::int, p_month, p_day) >= p_from
      then make_date(extract(year from p_from)::int, p_month, p_day)
      else make_date(extract(year from p_from)::int + 1, p_month, p_day)
  end;
$$;

-- ---------------------------------------------------------------------------
-- seed_household_starter_data: safe to call more than once; it no-ops if the
-- household already has items.
-- ---------------------------------------------------------------------------
create or replace function public.seed_household_starter_data(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_primary    text;
  v_patient_1  uuid;
  v_patient_2  uuid;
  v_scripps    uuid;
  v_sharp      uuid;
  v_radiology  uuid;
  v_plan       uuid;
  v_bill_a     uuid;
  v_eob_a      uuid;
begin
  if exists (select 1 from public.items where household_id = p_household_id) then
    return;
  end if;

  select coalesce(initcap(split_part(email, '@', 1)), 'Me')
    into v_primary
    from public.household_members
   where household_id = p_household_id
   order by created_at
   limit 1;
  v_primary := coalesce(v_primary, 'Me');

  -- -------------------------------------------------------------------------
  -- General hub items
  -- -------------------------------------------------------------------------
  insert into public.items (
    household_id, title, category, due_date, amount, recurrence,
    remind_days_before, priority, autopay, payee, account_reference, notes, created_by
  ) values
    (p_household_id, 'Mortgage payment', 'bill',
     date_trunc('month', current_date + interval '1 month')::date, null, 'monthly',
     7, 'high', false, 'Mr. Cooper', 'Mr. Cooper, last 4: 1234',
     'Due the 1st of each month. Update the amount once the current statement is in.', v_user),

    (p_household_id, 'Verify lender paid property tax from escrow — 1st installment', 'property',
     public.next_annual_date(12, 11), null, 'annual',
     7, 'normal', true, 'San Diego County Treasurer-Tax Collector', null,
     'San Diego County 1st installment is delinquent after Dec 10. Confirm the escrow disbursement actually posted — do not assume.', v_user),

    (p_household_id, 'Verify lender paid property tax from escrow — 2nd installment', 'property',
     public.next_annual_date(4, 11), null, 'annual',
     7, 'normal', true, 'San Diego County Treasurer-Tax Collector', null,
     'San Diego County 2nd installment is delinquent after Apr 10. Confirm the escrow disbursement actually posted.', v_user),

    (p_household_id, 'Watch for supplemental property tax bill (San Diego County)', 'property',
     (current_date + 30), null, 'none',
     14, 'high', false, 'San Diego County Treasurer-Tax Collector', null,
     'Supplemental bills after a purchase usually go to the owner, not the lender, and are NOT covered by escrow. Watch the mail and the county portal.', v_user),

    (p_household_id, 'Federal estimated tax — Q1 (Coast Media)', 'tax',
     public.next_annual_date(4, 15), null, 'annual', 14, 'high', false, 'IRS', null,
     'Business estimated tax, Coast Media. Q1 covers Jan 1 – Mar 31.', v_user),
    (p_household_id, 'Federal estimated tax — Q2 (Coast Media)', 'tax',
     public.next_annual_date(6, 15), null, 'annual', 14, 'high', false, 'IRS', null,
     'Business estimated tax, Coast Media. Q2 covers Apr 1 – May 31.', v_user),
    (p_household_id, 'Federal estimated tax — Q3 (Coast Media)', 'tax',
     public.next_annual_date(9, 15), null, 'annual', 14, 'high', false, 'IRS', null,
     'Business estimated tax, Coast Media. Q3 covers Jun 1 – Aug 31.', v_user),
    (p_household_id, 'Federal estimated tax — Q4 (Coast Media)', 'tax',
     public.next_annual_date(1, 15), null, 'annual', 14, 'high', false, 'IRS', null,
     'Business estimated tax, Coast Media. Q4 covers Sep 1 – Dec 31.', v_user),

    (p_household_id, 'California estimated tax — Q1 (FTB)', 'tax',
     public.next_annual_date(4, 15), null, 'annual', 14, 'high', false, 'CA Franchise Tax Board', null,
     'California has no September payment. CA weights the year 30% / 40% / 0% / 30%.', v_user),
    (p_household_id, 'California estimated tax — Q2 (FTB)', 'tax',
     public.next_annual_date(6, 15), null, 'annual', 14, 'high', false, 'CA Franchise Tax Board', null,
     'California has no September payment.', v_user),
    (p_household_id, 'California estimated tax — Q4 (FTB)', 'tax',
     public.next_annual_date(1, 15), null, 'annual', 14, 'high', false, 'CA Franchise Tax Board', null,
     'California has no September payment — the next one after June is January.', v_user),

    (p_household_id, 'HVAC filter change', 'home_maintenance',
     (current_date + 30), null, 'quarterly', 7, 'normal', false, null, null,
     'Check the filter size before ordering.', v_user),

    (p_household_id, 'Install water shutoff / leak detection device', 'home_maintenance',
     (current_date + 45), null, 'none', 14, 'high', false, null, null,
     'One-time. A slab or supply-line leak is the expensive failure this prevents.', v_user),

    (p_household_id, 'Book bi-annual NY family trip', 'travel',
     (current_date + 120), null, 'semiannual', 60, 'normal', false, null, null,
     'Book roughly two months out for fares and to lock in dates with family.', v_user),

    (p_household_id, 'VW Atlas lease turn-in', 'vehicle',
     date '2026-12-04', null, 'none', 60, 'high', false, 'VW Credit', null,
     'Decide buyout vs. return. Schedule the pre-inspection early and check mileage against the allowance.', v_user);

  -- -------------------------------------------------------------------------
  -- Medical: patients, providers, plan
  -- -------------------------------------------------------------------------
  insert into public.patients (household_id, full_name, created_by)
  values (p_household_id, v_primary, v_user) returning id into v_patient_1;

  insert into public.patients (household_id, full_name, created_by)
  values (p_household_id, 'Spouse', v_user) returning id into v_patient_2;

  insert into public.providers (household_id, name, phone, billing_portal_url, in_network, notes, created_by)
  values (p_household_id, 'Scripps Clinic', '858-555-0142', 'https://www.scripps.org/patients', true, null, v_user)
  returning id into v_scripps;

  insert into public.providers (household_id, name, phone, billing_portal_url, in_network, notes, created_by)
  values (p_household_id, 'Sharp Rees-Stealy', '858-555-0177', 'https://www.sharp.com/bill-pay', true, null, v_user)
  returning id into v_sharp;

  insert into public.providers (household_id, name, phone, billing_portal_url, in_network, notes, created_by)
  values (p_household_id, 'San Diego Radiology Associates', '619-555-0188', null, false,
          'Out of network — radiology is often billed separately from the facility.', v_user)
  returning id into v_radiology;

  insert into public.insurance_plans (
    household_id, name, plan_year, deductible, deductible_met,
    out_of_pocket_max, out_of_pocket_met, member_id_last4, created_by
  ) values (
    p_household_id, 'Family PPO', extract(year from current_date)::int,
    3000.00, 1250.00, 9000.00, 2100.00, '4821', v_user
  ) returning id into v_plan;

  -- -------------------------------------------------------------------------
  -- Bill A + its EOB: demonstrates the mismatch flag
  -- (statement says $842.00, the EOB says we owe $120.00)
  -- -------------------------------------------------------------------------
  insert into public.medical_bills (
    household_id, provider_id, patient_id, insurance_plan_id,
    date_of_service, statement_date, due_date, amount_billed,
    insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, hsa_fsa_eligible, reimbursement_status, created_by
  ) values (
    p_household_id, v_scripps, v_patient_1, v_plan,
    (current_date - 70), (current_date - 40), (current_date + 5), 842.00,
    'processed', true, 120.00, 0,
    'acct ending 5510', 'CLM-2026-88412', true, 'to_submit', v_user
  ) returning id into v_bill_a;

  insert into public.eobs (
    household_id, insurance_plan_id, provider_id, patient_id, claim_number,
    date_of_service, processed_date, amount_billed, allowed_amount,
    insurance_paid, patient_responsibility, notes, created_by
  ) values (
    p_household_id, v_plan, v_scripps, v_patient_1, 'CLM-2026-88412',
    (current_date - 70), (current_date - 35), 842.00, 310.00, 190.00, 120.00,
    'Allowed amount is well below billed. The statement was issued before the plan discount was applied.', v_user
  ) returning id into v_eob_a;

  insert into public.bill_eob_links (household_id, bill_id, eob_id, created_by)
  values (p_household_id, v_bill_a, v_eob_a, v_user);

  insert into public.bill_activity (
    household_id, bill_id, activity_type, occurred_on, spoke_with,
    reference_number, outcome, body, created_by
  ) values (
    p_household_id, v_bill_a, 'call', (current_date - 20), 'Billing dept.',
    'REF-77120', 'Said they would re-issue a corrected statement',
    'Called about the gap between the statement and the EOB. Nothing new in the mail yet.', v_user
  );

  -- -------------------------------------------------------------------------
  -- Bills B and C: same provider, same date of service, same amount.
  -- These demonstrate the duplicate flag.
  -- -------------------------------------------------------------------------
  insert into public.medical_bills (
    household_id, provider_id, patient_id, insurance_plan_id,
    date_of_service, statement_date, due_date, amount_billed,
    insurance_status, eob_received, amount_paid, account_number_on_bill, notes, created_by
  ) values
    (p_household_id, v_sharp, v_patient_2, v_plan,
     (current_date - 51), (current_date - 30), (current_date + 10), 275.00,
     'not_submitted', false, 0, 'acct ending 2043',
     'First statement received.', v_user),
    (p_household_id, v_sharp, v_patient_2, v_plan,
     (current_date - 51), (current_date - 20), (current_date + 20), 275.00,
     'not_submitted', false, 0, 'acct ending 2043',
     'Second statement for what looks like the same visit.', v_user);

  -- -------------------------------------------------------------------------
  -- Bill D: submitted to insurance, no EOB yet -> wait_for_eob
  -- -------------------------------------------------------------------------
  insert into public.medical_bills (
    household_id, provider_id, patient_id, insurance_plan_id,
    date_of_service, statement_date, due_date, amount_billed,
    insurance_status, eob_received, amount_paid, claim_number, created_by
  ) values (
    p_household_id, v_radiology, v_patient_1, v_plan,
    (current_date - 30), (current_date - 12), (current_date + 25), 410.00,
    'submitted', false, 0, 'CLM-2026-90733', v_user
  );
end;
$$;

revoke all on function public.seed_household_starter_data(uuid) from public;

-- ---------------------------------------------------------------------------
-- bootstrap_household: called by the app right after sign-in.
--   already a member -> return that household
--   pending invite for this email -> join it
--   otherwise -> create a household, add the user as owner, seed starter data
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
  v_invite    public.household_invites;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select u.email into v_email from auth.users u where u.id = v_user;
  if v_email is null then
    raise exception 'no email on account';
  end if;

  select hm.household_id into v_household
    from public.household_members hm
   where hm.user_id = v_user and hm.deleted_at is null
   order by hm.created_at
   limit 1;

  if v_household is not null then
    return v_household;
  end if;

  select i.* into v_invite
    from public.household_invites i
   where lower(i.email) = lower(v_email)
     and i.accepted_at is null
     and i.deleted_at is null
   order by i.created_at
   limit 1;

  if v_invite.id is not null then
    insert into public.household_members (household_id, user_id, email, display_name, role, created_by)
    values (v_invite.household_id, v_user, v_email,
            coalesce(v_invite.display_name, initcap(split_part(v_email, '@', 1))), 'member', v_user)
    on conflict do nothing;

    update public.household_invites
       set accepted_at = now(), accepted_by = v_user
     where id = v_invite.id;

    return v_invite.household_id;
  end if;

  insert into public.households (name, created_by)
  values ('Our Household', v_user)
  returning id into v_household;

  insert into public.household_members (household_id, user_id, email, display_name, role, created_by)
  values (v_household, v_user, v_email, initcap(split_part(v_email, '@', 1)), 'owner', v_user);

  perform public.seed_household_starter_data(v_household);

  return v_household;
end;
$$;

revoke all on function public.bootstrap_household() from public;
grant execute on function public.bootstrap_household() to authenticated;
grant execute on function public.next_annual_date(integer, integer, date) to authenticated;
