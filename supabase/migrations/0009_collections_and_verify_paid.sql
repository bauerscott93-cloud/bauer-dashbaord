-- 0009_collections_and_verify_paid.sql
--
-- Bills that have gone to an outside collection agency, and a new action for
-- bills that may already be paid.
--
-- IMPORTANT: run this file on its own, and let it finish, BEFORE running
-- supabase/seed-medical-bills.sql. Postgres will not let a new enum value be
-- used in the same transaction that adds it.

-- ---------------------------------------------------------------------------
-- Who is chasing the debt, and under what reference
-- ---------------------------------------------------------------------------
alter table public.medical_bills
  add column if not exists collector_name text;

alter table public.medical_bills
  add column if not exists collector_reference text;

comment on column public.medical_bills.collector_name is
  'Outside collection agency or attorney now holding the debt, when it has left the provider.';
comment on column public.medical_bills.collector_reference is
  'The agency''s own reference number for this account — what you quote on the phone.';

create index if not exists medical_bills_collector_idx
  on public.medical_bills (household_id, collector_name)
  where deleted_at is null and collector_name is not null;

-- ---------------------------------------------------------------------------
-- 'verify_paid': a bill that may already have been paid, where the next step
-- is to check a portal or statement rather than to pay again. It sits in the
-- Waiting column on the board.
-- ---------------------------------------------------------------------------
alter type public.bill_action add value if not exists 'verify_paid';
