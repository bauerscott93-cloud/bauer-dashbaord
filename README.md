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
| 1 | Scaffold, auth, household + invites, full schema with RLS, seed, app shell | **Done** |
| 2 | Items CRUD, recurrence, dashboard, table, calendar, soft delete | Not started |
| 3 | Medical bills: triage rules, board, table, drawer, CSV import, documents | Not started |
| 4 | Calendar feed, CSV export, invite polish, mobile polish, empty/error states | Not started |
| 5 | Optional bill scanning (needs an Anthropic API key) — only on request | Not started |

## Running it locally

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL and anon key
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
| `0002_core_tables.sql` | `households`, `household_members`, `household_invites`, `items`, `item_completions` |
| `0003_medical_tables.sql` | `patients`, `providers`, `insurance_plans`, `medical_bills`, `eobs`, `bill_eob_links`, `bill_activity`, `documents` |
| `0004_functions_and_triggers.sql` | `is_household_member()`, `updated_at` triggers, `next_due_date()`, `complete_item()` |
| `0005_rls_policies.sql` | Row Level Security on all 13 tables |
| `0006_storage.sql` | Private `documents` bucket + its storage policies |
| `0007_bootstrap_and_seed.sql` | `bootstrap_household()` and the starter seed data |

Each file is idempotent, so re-running one is safe.

`supabase/seed.sql` is only needed if you want to re-seed an existing household
by hand — the app seeds automatically on first sign-in.

### 2. Turn on magic-link auth

**Authentication → Providers → Email**: enable Email, and turn off password
sign-in so the only route in is the emailed link.

**Authentication → URL Configuration**: set the Site URL to your Vercel domain,
and add `http://localhost:5173` to Redirect URLs for local development.

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
3. Redeploy after adding them — Vite inlines env vars at build time, so a
   deploy built before they existed will not pick them up.

Both values are safe in the browser bundle: the anon key only grants what Row
Level Security allows. **Never** put the `service_role` key in a `VITE_*`
variable.

## How access control works

Every table carries `household_id`, and every policy is the same predicate:

```sql
public.is_household_member(household_id)
```

`is_household_member()` is `SECURITY DEFINER`, which is what keeps the policy on
`household_members` from recursing into itself.

Households are never inserted directly — there is deliberately no INSERT policy
on `households`. Sign-in calls the `bootstrap_household()` RPC, which:

1. returns your household if you already belong to one, else
2. joins the household that invited your email address, else
3. creates a household, makes you the owner, and seeds the starter data.

That is how a spouse invited on the Settings page lands in the **same**
household rather than a new one.

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
