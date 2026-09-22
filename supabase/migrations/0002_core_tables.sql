-- 0002_core_tables.sql
-- Households, membership, invites, and the general "items" hub.

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Our Household',
  timezone     text not null default 'America/Los_Angeles',
  default_remind_days_before int not null default 7,
  calendar_token uuid not null default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

-- household_id on households is its own id; kept as a generated column so that
-- every table in the schema can be queried the same way.
alter table public.households
  add column if not exists household_id uuid generated always as (id) stored;

-- ---------------------------------------------------------------------------
-- household_members
-- ---------------------------------------------------------------------------
create table if not exists public.household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  role          text not null default 'member' check (role in ('owner', 'member')),
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);

create unique index if not exists household_members_user_household_idx
  on public.household_members (household_id, user_id) where user_id is not null;
create index if not exists household_members_user_idx
  on public.household_members (user_id);
create index if not exists household_members_email_idx
  on public.household_members (lower(email));

-- ---------------------------------------------------------------------------
-- household_invites  (invite spouse by email; joined on their first sign-in)
-- ---------------------------------------------------------------------------
create table if not exists public.household_invites (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  email         text not null,
  display_name  text,
  accepted_at   timestamptz,
  accepted_by   uuid references auth.users(id) on delete set null,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);

create unique index if not exists household_invites_email_idx
  on public.household_invites (household_id, lower(email))
  where accepted_at is null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- items  (everything outside medical bills)
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households(id) on delete cascade,
  title               text not null check (length(btrim(title)) > 0),
  category            public.item_category not null default 'other',
  due_date            date not null,
  amount              numeric(10,2),
  recurrence          public.recurrence_type not null default 'none',
  -- only used when recurrence = 'custom': every N units
  recurrence_interval integer check (recurrence_interval is null or recurrence_interval > 0),
  recurrence_unit     public.recurrence_unit,
  remind_days_before  integer not null default 7 check (remind_days_before >= 0),
  priority            public.priority_level not null default 'normal',
  autopay             boolean not null default false,
  payee               text,
  -- free text only, e.g. "Mr. Cooper, last 4: 1234". Never a full account number.
  account_reference   text,
  link                text,
  notes               text,
  status              public.item_status not null default 'upcoming',
  owner_member_id     uuid references public.household_members(id) on delete set null,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  constraint items_custom_recurrence_complete check (
    recurrence <> 'custom'
    or (recurrence_interval is not null and recurrence_unit is not null)
  )
);

create index if not exists items_household_due_idx
  on public.items (household_id, due_date) where deleted_at is null;
create index if not exists items_household_status_idx
  on public.items (household_id, status) where deleted_at is null;
create index if not exists items_deleted_idx
  on public.items (household_id, deleted_at) where deleted_at is not null;

-- ---------------------------------------------------------------------------
-- item_completions  (history for recurring items; due_date rolls forward)
-- ---------------------------------------------------------------------------
create table if not exists public.item_completions (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  item_id        uuid not null references public.items(id) on delete cascade,
  completed_on   date not null default current_date,
  due_date       date,               -- the due date this completion satisfied
  amount_paid    numeric(10,2),
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null
);

create index if not exists item_completions_item_idx
  on public.item_completions (item_id, completed_on desc);
