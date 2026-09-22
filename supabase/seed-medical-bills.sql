-- seed-medical-bills.sql
--
-- One-time load of the real medical bills (24 rows, 21 debts, $6,508.09).
--
-- RUN 0009_collections_and_verify_paid.sql FIRST, and let it finish. Postgres
-- will not let the new 'verify_paid' enum value be used in the same
-- transaction that created it.
--
-- Safe to re-run: it detects an existing import and stops without doing
-- anything. See the bottom of this file for how to undo it.

create or replace function pg_temp.upsert_provider(p_hh uuid, p_name text)
returns uuid language plpgsql as $f$
declare v_id uuid;
begin
  select id into v_id from public.providers
   where household_id = p_hh and deleted_at is null
     and lower(btrim(name)) = lower(btrim(p_name)) limit 1;
  if v_id is null then
    insert into public.providers (household_id, name)
    values (p_hh, btrim(p_name)) returning id into v_id;
  end if;
  return v_id;
end $f$;

create or replace function pg_temp.upsert_patient(p_hh uuid, p_name text)
returns uuid language plpgsql as $f$
declare v_id uuid;
begin
  select id into v_id from public.patients
   where household_id = p_hh and deleted_at is null
     and lower(btrim(full_name)) = lower(btrim(p_name)) limit 1;
  if v_id is null then
    insert into public.patients (household_id, full_name)
    values (p_hh, btrim(p_name)) returning id into v_id;
  end if;
  return v_id;
end $f$;

do $seed$
declare
  v_hh    uuid;
  v_plan  uuid;
  v_alexa uuid;
  v_chase uuid;
  v_brooks uuid;
v_prov_0 uuid;
  v_prov_1 uuid;
  v_prov_2 uuid;
  v_prov_3 uuid;
  v_prov_4 uuid;
  v_prov_5 uuid;
  v_prov_6 uuid;
  v_prov_7 uuid;
  v_prov_8 uuid;
  v_prov_9 uuid;
  v_prov_10 uuid;
  v_count int;
  v_total numeric(10,2);
  v_retired int;
begin
  -- ---------------------------------------------------------------------
  -- Which household? There is only one; bail out rather than guess.
  -- ---------------------------------------------------------------------
  select id into v_hh from public.households order by created_at limit 1;
  if v_hh is null then
    raise exception 'No household exists yet. Sign in to the app once, then re-run this.';
  end if;
  if (select count(*) from public.households) > 1 then
    raise exception 'More than one household found. Set v_hh by hand before running this.';
  end if;

  -- Re-running must not double the data.
  if exists (
    select 1 from public.medical_bills
     where household_id = v_hh and deleted_at is null and account_number_on_bill = '8904'
  ) then
    raise notice 'These bills are already imported. Nothing to do.';
    return;
  end if;

  -- ---------------------------------------------------------------------
  -- Retire the sample medical data from migration 0007, so the summary bar
  -- shows your real numbers and not $1,080 of demo bills on top of them.
  -- These are soft deletes: see the undo block at the bottom.
  -- ---------------------------------------------------------------------
  update public.medical_bills set deleted_at = now()
   where household_id = v_hh and deleted_at is null
     and (account_number_on_bill in ('acct ending 5510', 'acct ending 2043')
          or claim_number = 'CLM-2026-90733');
  get diagnostics v_retired = row_count;
  raise notice 'Retired % sample bill(s).', v_retired;

  update public.eobs set deleted_at = now()
   where household_id = v_hh and deleted_at is null and claim_number = 'CLM-2026-88412';

  update public.insurance_plans set deleted_at = now()
   where household_id = v_hh and deleted_at is null and name = 'Family PPO';

  update public.providers set deleted_at = now()
   where household_id = v_hh and deleted_at is null
     and name in ('Scripps Clinic', 'Sharp Rees-Stealy', 'San Diego Radiology Associates');

  -- ---------------------------------------------------------------------
  -- Patients, plan, providers
  -- ---------------------------------------------------------------------
  v_alexa  := pg_temp.upsert_patient(v_hh, 'Alexa');
  v_chase  := pg_temp.upsert_patient(v_hh, 'Chase');
  v_brooks := pg_temp.upsert_patient(v_hh, 'Brooks');

  select id into v_plan from public.insurance_plans
   where household_id = v_hh and deleted_at is null and name = 'Cigna PPO' limit 1;
  if v_plan is null then
    insert into public.insurance_plans (household_id, name, plan_year, notes)
    values (v_hh, 'Cigna PPO', extract(year from current_date)::int,
            'Deductible and out-of-pocket figures are unknown until Cigna confirms them — see the reminder on the dashboard.')
    returning id into v_plan;
  end if;

v_prov_0 := pg_temp.upsert_provider(v_hh, 'The Valley Hospital');
  v_prov_1 := pg_temp.upsert_provider(v_hh, 'Valley Medical Group');
  v_prov_2 := pg_temp.upsert_provider(v_hh, 'Ridgewood Pathology Group');
  v_prov_3 := pg_temp.upsert_provider(v_hh, 'Labcorp');
  v_prov_4 := pg_temp.upsert_provider(v_hh, 'Valley Medical Group - Pediatric Specialty');
  v_prov_5 := pg_temp.upsert_provider(v_hh, 'Bergen Anesthesia Group');
  v_prov_6 := pg_temp.upsert_provider(v_hh, 'Tenafly Pediatrics');
  v_prov_7 := pg_temp.upsert_provider(v_hh, 'Rady Children''s Specialists of SD (anesthesia)');
  v_prov_8 := pg_temp.upsert_provider(v_hh, 'Rady Children''s Specialists of SD (GI)');
  v_prov_9 := pg_temp.upsert_provider(v_hh, 'Rady Children''s Specialists of SD (pathology)');
  v_prov_10 := pg_temp.upsert_provider(v_hh, 'Children''s Primary Care Medical Group');

  -- ---------------------------------------------------------------------
  -- The bills. amount_billed holds the CURRENT BALANCE OWED, not the
  -- original charge; original charges and insurance payments are in notes.
  -- A blank insurance_status in the CSV is loaded as 'not_submitted', which
  -- is also what makes the triage rules suggest calling.
  -- ---------------------------------------------------------------------
insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_alexa, v_prov_0, v_plan,
    '2025-06-25', '2026-06-23', null,
    500.25, 'not_submitted'::public.insurance_status,
      false, null, 0,
    '8904', null, 'Celentano, Stadtmauer & Walentowicz', '0600355631',
    'call_provider'::public.bill_action, 'One call to the collector covers all 8 of Alexa’s Valley Hospital accounts. Confirm each against the Cigna EOB and ask for a lump-sum discount.', 'In collections with Celentano, Stadtmauer & Walentowicz (ref 0600355631). Letter says 4th notice. Verify against EOB.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_alexa, v_prov_0, v_plan,
    '2025-08-18', '2026-06-25', null,
    438.43, 'not_submitted'::public.insurance_status,
      false, null, 0,
    '0596', null, 'Celentano, Stadtmauer & Walentowicz', '0600360286',
    'call_provider'::public.bill_action, 'One call to the collector covers all 8 of Alexa’s Valley Hospital accounts. Confirm each against the Cigna EOB and ask for a lump-sum discount.', 'In collections with Celentano, Stadtmauer & Walentowicz (ref 0600360286). Verify against EOB.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_alexa, v_prov_0, v_plan,
    '2025-09-02', '2026-06-25', null,
    322.45, 'not_submitted'::public.insurance_status,
      false, null, 0,
    '0602', null, 'Celentano, Stadtmauer & Walentowicz', '0600360287',
    'call_provider'::public.bill_action, 'One call to the collector covers all 8 of Alexa’s Valley Hospital accounts. Confirm each against the Cigna EOB and ask for a lump-sum discount.', 'In collections with Celentano, Stadtmauer & Walentowicz (ref 0600360287). Verify against EOB.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_alexa, v_prov_0, v_plan,
    '2025-10-21', '2026-08-10', null,
    88.07, 'not_submitted'::public.insurance_status,
      false, null, 0,
    '5036', null, 'Celentano, Stadtmauer & Walentowicz', '0600362589',
    'call_provider'::public.bill_action, 'One call to the collector covers all 8 of Alexa’s Valley Hospital accounts. Confirm each against the Cigna EOB and ask for a lump-sum discount.', 'In collections with Celentano, Stadtmauer & Walentowicz (ref 0600362589). Verify against EOB.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_alexa, v_prov_0, v_plan,
    '2025-11-10', '2026-06-25', null,
    115.47, 'not_submitted'::public.insurance_status,
      false, null, 0,
    '3255', null, 'Celentano, Stadtmauer & Walentowicz', '0600360552',
    'call_provider'::public.bill_action, 'One call to the collector covers all 8 of Alexa’s Valley Hospital accounts. Confirm each against the Cigna EOB and ask for a lump-sum discount.', 'In collections with Celentano, Stadtmauer & Walentowicz (ref 0600360552). Verify against EOB.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_alexa, v_prov_0, v_plan,
    '2025-12-01', '2026-06-22', null,
    206.31, 'processed'::public.insurance_status,
      false, null, 0,
    '8982', null, 'Celentano, Stadtmauer & Walentowicz', '0600362226',
    'call_provider'::public.bill_action, 'One call to the collector covers all 8 of Alexa’s Valley Hospital accounts. Confirm each against the Cigna EOB and ask for a lump-sum discount.', 'In collections (ref 0600362226). Original $1,860.00, $1,653.69 already paid or credited. 3 copies of this letter received.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_alexa, v_prov_0, v_plan,
    '2025-12-08', '2026-08-10', null,
    117.97, 'processed'::public.insurance_status,
      false, null, 0,
    '8989', null, 'Celentano, Stadtmauer & Walentowicz', '0600362462',
    'call_provider'::public.bill_action, 'One call to the collector covers all 8 of Alexa’s Valley Hospital accounts. Confirm each against the Cigna EOB and ask for a lump-sum discount.', 'In collections (ref 0600362462). Original $1,066.00, $948.03 already paid or credited. Letters dated Jun 22 and Aug 10 are the same debt.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_alexa, v_prov_0, v_plan,
    '2025-11-24', '2026-07-22', null,
    118.24, 'not_submitted'::public.insurance_status,
      false, null, 0,
    '8977', null, 'Celentano, Stadtmauer & Walentowicz', '0600360960',
    'call_provider'::public.bill_action, 'One call to the collector covers all 8 of Alexa’s Valley Hospital accounts. Confirm each against the Cigna EOB and ask for a lump-sum discount.', 'In collections with Celentano, Stadtmauer & Walentowicz (ref 0600360960). Verify against EOB.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_chase, v_prov_0, v_plan,
    '2026-02-27', '2026-07-06', null,
    572.55, 'processed'::public.insurance_status,
      false, null, 0,
    '6799', null, null, null,
    'call_provider'::public.bill_action, 'Insurance paid $0.00 on this one. Check the Cigna EOB for why before paying.', 'Still with the hospital (FINAL NOTICE, headed to collections). Billed $579.00, insurance paid $0.00, adjustment $6.45. Check EOB for why insurance paid nothing. Rep: Spencer Taltavull (201) 301-6164. Interest-free plans via Care Cap Plus (800) 264-2274.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_brooks, v_prov_0, v_plan,
    '2026-03-04', '2026-07-06', null,
    2209.86, 'processed'::public.insurance_status,
      false, null, 0,
    '5114', null, null, null,
    null, null, 'Still with the hospital (FINAL NOTICE, headed to collections). Billed $13,488.00, insurance paid $1,731.14, adjustments $9,547.00. Confirm $2,209.86 matches EOB. Rep: Spencer Taltavull (201) 301-6164. Interest-free plans via Care Cap Plus (800) 264-2274.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_chase, v_prov_1, v_plan,
    '2026-02-27', '2026-08-16', '2026-09-06',
    81.32, 'processed'::public.insurance_status,
      true, 81.32, 0,
    '5242', null, null, null,
    null, null, 'Radiologist''s fee for the same Feb 27 visit as the Valley Hospital bill (separate charge, not a duplicate). Charge $233.00, insurance adjustments $151.68, rest applied to Cigna deductible. Jul 3 and Aug 16 statements are the same bill. Pay at pay.imaginepay.com/provider/VMG or (888) 389-8704.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_brooks, v_prov_2, v_plan,
    null, '2026-08-31', null,
    212.97, 'not_submitted'::public.insurance_status,
      false, null, 0,
    '2409', null, 'Michael Harrison, Attorney at Law', 'RPG 1872409',
    'call_provider'::public.bill_action, 'Get the date of service and an itemised bill before paying anything.', 'In collections with Michael Harrison, Attorney at Law (ref RPG 1872409), (973) 989-4227, mhesq.com. Pathology at Valley Hospital; date of service not on letters (likely the Mar 4 visit). Separate from the hospital bill. Jul 20 and Aug 31 letters are the same debt. Ask for date of service and check Cigna EOB.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_brooks, v_prov_3, v_plan,
    '2026-03-27', '2026-08-01', null,
    54.85, 'not_submitted'::public.insurance_status,
      false, null, 0,
    '8785', null, null, null,
    null, null, 'Still with Labcorp (not an outside collector yet), marked severely delinquent. Lab test ordered by VMG Peds Pulmonary. Invoice 87118785. Two notices are the same bill. Pay at labcorp.com/billing or 1-800-845-6167.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_brooks, v_prov_4, v_plan,
    '2026-03-27', '2026-07-26', null,
    67.88, 'processed'::public.insurance_status,
      true, 67.88, 0,
    '5622', null, null, null,
    null, null, 'Dr. Jacob Kattan, new patient visit (99205). Charge $745.00, Cigna paid $271.54, adjustment $405.58; you owe coinsurance. Same visit date as the Labcorp test (separate bill). Practice statement, 3rd notice. Pay at payment.athenahealth.com or 201-291-6049.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_brooks, v_prov_4, v_plan,
    '2026-05-05', '2026-07-26', null,
    35.62, 'processed'::public.insurance_status,
      true, 35.62, 0,
    '5622', null, null, null,
    null, null, 'Dr. Jacob Kattan, follow-up visit (99214). Charge $325.00, Cigna paid $142.50, adjustment $146.88; you owe coinsurance. Same account as the other VMG Pediatric Specialty rows.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, null, v_prov_4, v_plan,
    null, '2026-07-26', null,
    368.44, 'processed'::public.insurance_status,
      false, null, 0,
    '5622', null, null, null,
    'wait_for_eob'::public.bill_action, 'Need the back of page 1 of the Jul 26 statement before this can be split out.', 'Remaining 3 of 5 services on the Jul 26 statement ($471.94 total). Details are on the back of page 1, which wasn''t photographed. Fill in patient and dates once seen.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_brooks, v_prov_5, v_plan,
    '2026-03-04', '2026-07-17', '2026-08-16',
    218.94, 'processed'::public.insurance_status,
      true, 218.94, 0,
    '6310', null, null, null,
    null, null, 'Anesthesia for the Mar 4 endoscopy (Dr. Mikhail Kagan). Charge $2,970.00, Cigna paid $875.74, disallowed $1,875.32; you owe coinsurance. Same day as the Valley Hospital bill (separate charge). FINAL NOTICE. Pay at bergenanesthesiagroup.com or 201-847-9320.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_brooks, v_prov_6, v_plan,
    '2026-01-12', '2026-09-06', '2026-09-27',
    10.12, 'processed'::public.insurance_status,
      true, 10.12, 0,
    '2500', null, null, null,
    null, null, 'Office visit with Dr. Paul Harlow (99213). Charge $100.00; you already paid $76.45. Remaining balance applied to deductible after Cigna reprocessed in July. Pay at TenaflyPediatrics.com or (201) 541-9104.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_brooks, v_prov_6, v_plan,
    '2026-02-20', '2026-09-06', '2026-09-27',
    16.73, 'processed'::public.insurance_status,
      true, 16.73, 0,
    '2500', null, null, null,
    null, null, 'Office visit with Dr. Paul Harlow (99214). Charge $150.00; you already paid $114.86. Remaining balance applied to deductible after Cigna reprocessed in July. Same account as the Jan 12 row.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_brooks, v_prov_7, v_plan,
    '2026-06-17', '2026-07-30', null,
    294, 'processed'::public.insurance_status,
      true, 294, 0,
    '8163', null, null, null,
    null, null, 'Anesthesia for a Jun 17 endoscopy (code 00731). Charge $2,100.00, Cigna paid $1,176.00, adjustment $630.00; you owe coinsurance. Separate from the Mar 4 procedure. Due on receipt. Pay at paynow.coronisglobal.com or (800) 222-1442.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_brooks, v_prov_8, v_plan,
    '2026-06-29', '2026-08-18', '2026-09-02',
    135.78, 'processed'::public.insurance_status,
      true, 135.78, 0,
    '0497', null, null, null,
    null, null, 'Gastroenterology new patient visit (99203). Charge $414.00, Cigna paid $166.04, adjustment $112.18. You owe $94.27 deductible + $41.51 coinsurance. Same group as the Jun 17 anesthesia bill but a different account and service. Pay at rchsd.org/mychart or (858) 309-6290.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_brooks, v_prov_8, v_plan,
    '2026-06-17', '2026-07-05', '2026-07-20',
    71.73, 'processed'::public.insurance_status,
      true, 71.73, 0,
    '0497', null, null, null,
    'verify_paid'::public.bill_action, 'The later Aug 18 statement on this account doesn’t list it. Check MyChart before paying.', 'GI doctor''s fee for the Jun 17 endoscopy with biopsy (43239). Charge $489.00, Cigna paid $286.90, adjustment $130.37; coinsurance only. POSSIBLY ALREADY PAID: the later Aug 18 statement on this same account doesn''t show it. Check MyChart before paying.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_brooks, v_prov_9, v_plan,
    '2026-06-17', '2026-07-05', '2026-07-20',
    54.85, 'processed'::public.insurance_status,
      true, 54.85, 0,
    '0497', null, null, null,
    'verify_paid'::public.bill_action, 'Not on the later Aug 18 statement for this account. Check MyChart before paying.', 'Pathology exam of Jun 17 biopsy (88305). Charge $924.00, Cigna paid $219.41, adjustment $649.74; coinsurance only. POSSIBLY ALREADY PAID: not on the later Aug 18 statement for this account. Check MyChart before paying.'
  );

  insert into public.medical_bills (
    household_id, patient_id, provider_id, insurance_plan_id,
    date_of_service, statement_date, due_date,
    amount_billed, insurance_status, eob_received, patient_responsibility_per_eob, amount_paid,
    account_number_on_bill, claim_number, collector_name, collector_reference,
    action, action_reason, notes
  ) values (
    v_hh, v_brooks, v_prov_10, v_plan,
    '2026-06-22', '2026-08-27', null,
    195.26, 'processed'::public.insurance_status,
      true, 195.26, 0,
    '5083', null, null, null,
    null, null, 'Dr. Gregory Montoya visit: office visit (99214) $172.47, form fee (99080) $20.00, hemoglobin test (85018) $2.79. Cigna paid $0 and applied discounts of $193.74, so the rest went to deductible. Replaces the Jun 28 statement for the $20 form fee. Pay via Rady MyChart Guest Pay or 858-502-1100.'
  );

  -- ---------------------------------------------------------------------
  -- Follow-up items for the general hub
  -- ---------------------------------------------------------------------
  insert into public.items (household_id, title, category, due_date, recurrence,
                            remind_days_before, priority, notes)
  values
    (v_hh, 'Call Cigna about 2026 deductible and out-of-pocket max', 'bill',
     current_date + 3, 'none', 1, 'high',
     'Jun 17 claims (processed Jun 26) were coinsurance only, but claims processed in July (Jun 22, Jun 29, and the reprocessed Jan/Feb visits) went to deductible. Ask: how much deductible and OOP max is met per person and per family, when does the plan year start, and were the July claims processed correctly?'),

    (v_hh, 'Call Celentano (973-778-1771) about Alexa''s 8 Valley Hospital accounts', 'bill',
     current_date + 7, 'none', 3, 'high',
     'Confirm the total is $1,907.19, give them the new Carlsbad address, ask about a lump-sum discount, and get written $0 confirmation after paying.'),

    (v_hh, 'Call Valley Hospital rep Spencer Taltavull (201-301-6164)', 'bill',
     current_date + 7, 'none', 3, 'high',
     'Chase $572.55 + Brooks $2,209.86. Ask about the interest-free 8/12/18-month plans and about financial assistance.'),

    (v_hh, 'Watch for Rady Children''s Hospital facility bill for Brooks''s Jun 17 procedure', 'bill',
     current_date + 30, 'none', 14, 'normal',
     'The anesthesia, GI and pathology bills have arrived; the hospital facility bill has not.');

  -- ---------------------------------------------------------------------
  -- Correction to the starter seed
  -- ---------------------------------------------------------------------
  update public.items
     set notes = 'Returning to VW Credit.'
   where household_id = v_hh and title = 'VW Atlas lease turn-in' and deleted_at is null;

  -- ---------------------------------------------------------------------
  -- Retire sample patients — anyone with no live bills left after the import
  -- ---------------------------------------------------------------------
  update public.patients p set deleted_at = now()
   where p.household_id = v_hh and p.deleted_at is null
     and lower(btrim(p.full_name)) not in ('alexa', 'chase', 'brooks')
     and not exists (
       select 1 from public.medical_bills b
        where b.patient_id = p.id and b.deleted_at is null
     );

  select count(*), coalesce(sum(balance), 0) into v_count, v_total
    from public.medical_bills where household_id = v_hh and deleted_at is null;

  raise notice 'Imported. % live bills, total balance %.', v_count, v_total;
end
$seed$;

-- ---------------------------------------------------------------------------
-- What landed
-- ---------------------------------------------------------------------------
select count(*) as bills,
       to_char(sum(balance), 'FM$999,999.00') as total_balance
  from public.medical_bills
 where deleted_at is null;

select coalesce(action::text, '(following the rules)') as action,
       count(*) as bills,
       to_char(sum(balance), 'FM$999,999.00') as balance
  from public.medical_bills
 where deleted_at is null
 group by 1 order by 2 desc;

-- ---------------------------------------------------------------------------
-- Undo
-- ---------------------------------------------------------------------------
-- Remove this import and bring the sample data back:
--
--   update public.medical_bills set deleted_at = now()
--    where account_number_on_bill in ('8904','0596','0602','5036','3255','8982',
--          '8989','8977','6799','5114','5242','2409','8785','5622','6310','2500',
--          '8163','0497','5083') and deleted_at is null;
--   update public.medical_bills set deleted_at = null
--    where account_number_on_bill in ('acct ending 5510','acct ending 2043')
--       or claim_number = 'CLM-2026-90733';
--   update public.eobs set deleted_at = null where claim_number = 'CLM-2026-88412';
--   update public.insurance_plans set deleted_at = null where name = 'Family PPO';
--   update public.providers set deleted_at = null
--    where name in ('Scripps Clinic','Sharp Rees-Stealy','San Diego Radiology Associates');
