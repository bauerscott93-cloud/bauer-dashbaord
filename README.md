# Household Hub

One place to track the important, non-daily things that cost money or cause
pain if missed: bills, deadlines, recurring maintenance, business tax payments,
planning reminders — and a dedicated **Medical Bills** triage desk.

Not a calendar. Not a daily task app.

## Stack

Only GitHub, Vercel, and Supabase. No other accounts or API keys.

| Piece | What |
| --- | --- |
| App | React + Vite (JavaScript), Tailwind CSS |
| Data, auth, files | Supabase (`@supabase/supabase-js`) |
| Hosting | Vercel, auto-deploying from GitHub |

Dependencies are deliberately minimal: React, React Router, Tailwind, and the
Supabase client. Date math and form validation are plain JavaScript.

## Build phases

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Scaffold, shared-password auth, household, full schema with RLS, seed, app shell | **Done** |
| 2 | Items CRUD, recurrence, dashboard, table, calendar, soft delete | Not started |
| 3 | Medical bills: triage rules, board, table, drawer, CSV import, documents | Not started |
| 4 | Calendar feed, CSV export, mobile polish, empty/error states | Not started |
| 5 | Optional bill scanning (needs an Anthropic API key) — only on request | Not started |

## Running it locally

```bash
npm install
cp .env.example .env.local   # then fill in the three values
npm run dev                  # http://localhost:5173
```

`npm run build` produces `dist/`. `npm run preview` serves that build.

If the env vars are missing the app shows a setup screen rather than a blank
page.

## Supabase setup

### 1. Run the migrations

In the Supabase dashboard → **SQL Editor**, run the files in
`supabase/migrations/` **in numerical order**:

| File | What it does |
| --- | --- |
| `0001_extensions_and_enums.sql` | `pgcrypto` and every enum type |
| `0002_core_tables.sql` | `households`, `household_members`, `items`, `item_completions` (and `household_invites`, which `0008` removes) |
| `0003_medical_tables.sql` | `patients`, `providers`, `insurance_plans`, `medical_bills`, `eobs`, `bill_eob_links`, `bill_activity`, `documents` |
| `0004_functions_and_triggers.sql` | `is_household_member()`, `updated_at` triggers, `next_due_date()`, `complete_item()` |
| `0005_rls_policies.sql` | Row Level Security on all 13 tables |
| `0006_storage.sql` | Private `documents` bucket + its storage policies |
| `0007_bootstrap_and_seed.sql` | `bootstrap_household()` and the starter seed data |
| `0008_shared_password_auth.sql` | Switches sign-in to one shared password; splits logins from people |

Each file is idempotent, so re-running one is safe.

`supabase/seed.sql` is only needed if you want to re-seed an existing household
by hand — the app seeds automatically on first sign-in.

### 2. Create the one shared account

Sign-in is a single shared password. Supabase needs an identifier behind any
password, so there is one account and the app fills the address in for you —
the sign-in screen only asks for the password.

**Authentication → Users → Add user**:

- Email: anything you'll remember, e.g. `household@bauer.home`. It never
  receives mail, so it does not have to be a real inbox.
- Password: pick a strong one. This is the only thing standing between the
  internet and your medical bills, and there is no rate-limited second factor
  behind it.
- Tick **Auto Confirm User**. Without it the account can't sign in, because
  there's no inbox to confirm from.

Put that same address in `VITE_HOUSEHOLD_EMAIL`.

**Authentication → Providers → Email**: leave Email enabled (password sign-in
lives under it), and turn **off** "Confirm email".

**Authentication → Sign In / Providers → turn OFF "Allow new users to sign
up."** Do this. Your app URL is public, and with signups open anyone who finds
it could create their own account. They would land in a separate empty
household rather than yours, but there is no reason to allow it at all.

To change the password later, use Settings inside the app. If it's ever lost
there's no reset email — change it from Authentication → Users.

### 3. Nothing else

The `documents` storage bucket is created by migration `0006`. It is private;
only household members can read their own files.

## Vercel setup

1. Import the GitHub repo. Vercel detects Vite; `vercel.json` pins the build
   command, output directory, and the SPA rewrite.
2. **Project Settings → Environment Variables**, for Production, Preview, and
   Development:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_HOUSEHOLD_EMAIL`
3. Redeploy after adding them — Vite inlines env vars at build time, so a
   deploy built before they existed will not pick them up.

All three are safe in the browser bundle: the anon key only grants what Row
Level Security allows, and the household address is only an identifier — the
password is what actually gates access. **Never** put the `service_role` key in
a `VITE_*` variable.

## How access control works

Two things that sound alike are kept separate:

- **`household_users`** — which login can open which household. With a shared
  password there is exactly one row.
- **`household_members`** — the *people* (you, your wife). These are plain
  records used for an item's `owner`. They are not logins, so removing one
  can't lock anyone out.

Every table carries `household_id`, and every policy is the same predicate:

```sql
public.is_household_member(household_id)
```

`is_household_member()` is `SECURITY DEFINER`, which is what keeps the policy on
`household_users` from recursing into itself.

Neither `households` nor `household_users` has an INSERT policy — you cannot
grant yourself access to a household from the browser. Sign-in calls the
`bootstrap_household()` RPC, which returns your household if this login already
has one, and otherwise creates one, links the login, and seeds it.

An unrecognised account deliberately gets its **own** household rather than
joining an existing one, so that if signups were ever left open a stranger
would land somewhere empty. To attach a second login to your household on
purpose, see the SQL at the bottom of `0008_shared_password_auth.sql`.

Files live in the private `documents` bucket under `<household_id>/…`, and the
storage policies authorize on that first path segment.

## Data conventions

- Dates are `date` columns, never timestamps, and are handled in the UI as
  `YYYY-MM-DD` strings parsed at local noon so a DST shift can't move a day.
- Money is `numeric(10,2)`. Never floats.
- Deletes are soft (`deleted_at`), with a "Recently deleted" view planned for
  Phase 2.
- Account references are free text only ("Mr. Cooper, last 4: 1234"). Full
  account numbers and full insurance member IDs are never stored.

## Seed data

First sign-in creates a household pre-filled with the mortgage, both property
tax escrow checks, the San Diego supplemental tax watch, federal and California
estimated tax dates, HVAC filter changes, the leak detection install, the
bi-annual NY trip, and the VW Atlas lease turn-in — plus sample medical bills
and an EOB that demonstrate the mismatch and duplicate flags.

Amounts are placeholders; edit them in the app.
