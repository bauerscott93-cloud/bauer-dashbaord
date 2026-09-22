-- seed.sql
--
-- The starter data itself lives in a function so that it can run at first
-- sign-in, when the household id is known:
--   supabase/migrations/0007_bootstrap_and_seed.sql -> seed_household_starter_data()
--
-- The app calls bootstrap_household() after sign-in, which creates the
-- household and seeds it. You normally do not need to run anything here.
--
-- Use this file to (re)seed an existing household by hand — for example after
-- clearing data while developing. It no-ops on any household that already has
-- items, so it is safe to re-run.

-- Seed every household you belong to:
select public.seed_household_starter_data(hm.household_id)
  from public.household_members hm
 where hm.user_id = auth.uid();

-- Or seed one specific household:
-- select public.seed_household_starter_data('00000000-0000-0000-0000-000000000000');
