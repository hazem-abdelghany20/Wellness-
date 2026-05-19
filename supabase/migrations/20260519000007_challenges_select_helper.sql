-- challenges SELECT policy still used the raw JWT pattern, so superadmins
-- and freshly-onboarded users couldn't see their own company's scheduled
-- challenges. Switch to public.auth_company_id() — keeps the "company_id
-- IS NULL means shared catalogue" rule that the original policy had.

DROP POLICY IF EXISTS "challenges_company_read" ON public.challenges;
CREATE POLICY "challenges_company_read" ON public.challenges
  FOR SELECT USING (
    company_id IS NULL
    OR company_id = public.auth_company_id()
  );
