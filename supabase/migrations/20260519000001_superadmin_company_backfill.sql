-- Backfill profile.company_id + role for superadmin emails so Settings,
-- writes, and RPCs work for hazem@ without forcing a re-signup.
-- Superadmins are treated as company_admin against the Wellhouse Group demo
-- company (matches the seed data the rest of the portal renders from).

DO $$
DECLARE
  v_company UUID := '00000000-0000-0000-0000-000000000001';
  v_user RECORD;
BEGIN
  -- Ensure demo company exists (no-op if already seeded)
  INSERT INTO public.companies (id, name, slug, code, plan, settings)
  VALUES (v_company, 'Wellhouse Group', 'wellhouse', 'WH-4782', 'enterprise',
          '{"locale":"en","timezone":"Asia/Dubai"}')
  ON CONFLICT (id) DO NOTHING;

  FOR v_user IN
    SELECT id, email
      FROM auth.users
     WHERE lower(email) IN (
       'hazemabdelghany43@gmail.com',
       'hazemabdelghany@gmail.com'
     )
  LOOP
    INSERT INTO public.profiles (id, company_id, display_name, role, onboarded)
    VALUES (v_user.id, v_company, split_part(v_user.email, '@', 1), 'company_admin', true)
    ON CONFLICT (id) DO UPDATE
      SET company_id = COALESCE(public.profiles.company_id, v_company),
          role = CASE
            WHEN public.profiles.role IN ('company_admin', 'super_admin') THEN public.profiles.role
            ELSE 'company_admin'
          END,
          onboarded = true;
  END LOOP;
END $$;
