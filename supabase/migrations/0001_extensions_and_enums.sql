-- 0001_extensions_and_enums.sql
-- Base extensions and the enumerated types used across the household hub.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- General hub enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.item_category as enum (
    'bill', 'tax', 'property', 'home_maintenance', 'vehicle',
    'travel', 'business', 'insurance', 'subscription', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recurrence_type as enum (
    'none', 'monthly', 'quarterly', 'semiannual', 'annual', 'custom'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recurrence_unit as enum ('day', 'week', 'month');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.priority_level as enum ('low', 'normal', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.item_status as enum ('upcoming', 'done', 'skipped');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Medical bill enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.insurance_status as enum (
    'not_submitted', 'submitted', 'processed', 'denied', 'not_applicable'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.bill_action as enum (
    'pay', 'wait_for_insurance', 'wait_for_eob', 'call_provider',
    'dispute', 'ignore', 'paid', 'resolved'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reimbursement_status as enum (
    'n/a', 'to_submit', 'submitted', 'reimbursed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.bill_activity_type as enum (
    'call', 'note', 'payment', 'status_change', 'document'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_entity as enum ('item', 'medical_bill', 'eob');
exception when duplicate_object then null; end $$;
