-- 0003_medical_tables.sql
-- The medical bills triage module: patients, providers, plans, bills, EOBs,
-- the bill<->EOB join, the activity log, and shared document metadata.

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
create table if not exists public.patients (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  full_name     text not null check (length(btrim(full_name)) > 0),
  date_of_birth date,
  notes         text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);

create unique index if not exists patients_household_name_idx
  on public.patients (household_id, lower(btrim(full_name))) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- providers
-- ---------------------------------------------------------------------------
create table if not exists public.providers (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households(id) on delete cascade,
  name               text not null check (length(btrim(name)) > 0),
  phone              text,
  billing_portal_url text,
  -- needed by triage rule 1 ("no insurance submission recorded and the
  -- provider is in-network -> confirm they billed insurance").
  in_network         boolean not null default true,
  notes              text,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null
);

create unique index if not exists providers_household_name_idx
  on public.providers (household_id, lower(btrim(name))) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- insurance_plans  (amounts met are updated by hand)
-- ---------------------------------------------------------------------------
create table if not exists public.insurance_plans (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households(id) on delete cascade,
  name                text not null check (length(btrim(name)) > 0),
  plan_year           integer not null default extract(year from current_date)::int,
  deductible          numeric(10,2),
  deductible_met      numeric(10,2) not null default 0,
  out_of_pocket_max   numeric(10,2),
  out_of_pocket_met   numeric(10,2) not null default 0,
  -- last 4 only, never the full member ID
  member_id_last4     text check (member_id_last4 is null or member_id_last4 ~ '^[0-9A-Za-z]{1,4}$'),
  notes               text,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null
);

create index if not exists insurance_plans_household_idx
  on public.insurance_plans (household_id, plan_year) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- medical_bills
-- ---------------------------------------------------------------------------
create table if not exists public.medical_bills (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  provider_id   uuid references public.providers(id) on delete set null,
  patient_id    uuid references public.patients(id) on delete set null,
  insurance_plan_id uuid references public.insurance_plans(id) on delete set null,

  date_of_service date,
  statement_date  date,
  due_date        date,

  amount_billed   numeric(10,2) not null default 0,
  insurance_status public.insurance_status not null default 'not_submitted',
  eob_received    boolean not null default false,
  patient_responsibility_per_eob numeric(10,2),
  amount_paid     numeric(10,2) not null default 0,

  -- What we actually still owe: the EOB's number when we have it, otherwise
  -- whatever the statement claims, minus anything already paid.
  balance numeric(10,2) generated always as (
    coalesce(patient_responsibility_per_eob, amount_billed) - coalesce(amount_paid, 0)
  ) stored,

  account_number_on_bill text,   -- reference text only, never a full account number
  claim_number           text,

  hsa_fsa_eligible     boolean not null default false,
  reimbursement_status public.reimbursement_status not null default 'n/a',

  payment_plan_amount    numeric(10,2),
  payment_plan_next_date date,

  -- action is what we decided. Null means "follow the app's suggestion".
  action         public.bill_action,
  action_reason  text,
  follow_up_date date,
  notes          text,

  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

create index if not exists medical_bills_household_idx
  on public.medical_bills (household_id) where deleted_at is null;
create index if not exists medical_bills_action_idx
  on public.medical_bills (household_id, action) where deleted_at is null;
create index if not exists medical_bills_followup_idx
  on public.medical_bills (household_id, follow_up_date) where deleted_at is null;
-- supports the duplicate check (same provider + same date of service)
create index if not exists medical_bills_dupe_idx
  on public.medical_bills (household_id, provider_id, date_of_service) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- eobs  (Explanation of Benefits)
-- ---------------------------------------------------------------------------
create table if not exists public.eobs (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  insurance_plan_id uuid references public.insurance_plans(id) on delete set null,
  provider_id   uuid references public.providers(id) on delete set null,
  patient_id    uuid references public.patients(id) on delete set null,
  claim_number    text,
  date_of_service date,
  processed_date  date,
  amount_billed          numeric(10,2),
  allowed_amount         numeric(10,2),
  insurance_paid         numeric(10,2),
  patient_responsibility numeric(10,2),
  notes       text,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

create index if not exists eobs_household_idx
  on public.eobs (household_id, date_of_service) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- bill_eob_links  (an EOB can cover several bills, and vice versa)
-- ---------------------------------------------------------------------------
create table if not exists public.bill_eob_links (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  bill_id       uuid not null references public.medical_bills(id) on delete cascade,
  eob_id        uuid not null references public.eobs(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  unique (bill_id, eob_id)
);

-- ---------------------------------------------------------------------------
-- bill_activity  (calls made, who we spoke to, reference numbers, outcomes)
-- ---------------------------------------------------------------------------
create table if not exists public.bill_activity (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  bill_id       uuid not null references public.medical_bills(id) on delete cascade,
  activity_type public.bill_activity_type not null default 'note',
  occurred_on   date not null default current_date,
  spoke_with    text,
  reference_number text,
  outcome       text,
  body          text,
  amount        numeric(10,2),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);

create index if not exists bill_activity_bill_idx
  on public.bill_activity (bill_id, occurred_on desc, created_at desc);

-- ---------------------------------------------------------------------------
-- documents  (metadata; bytes live in the private `documents` storage bucket)
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  entity_type   public.document_entity not null,
  entity_id     uuid not null,
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint,
  notes         text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);

create index if not exists documents_entity_idx
  on public.documents (household_id, entity_type, entity_id) where deleted_at is null;
