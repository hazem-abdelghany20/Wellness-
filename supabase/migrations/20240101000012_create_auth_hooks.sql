-- Custom JWT claims hook — injects company_id and role into app_metadata
-- This runs on every token mint/refresh
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_profile    RECORD;
  v_claims     JSONB;
BEGIN
  v_claims := event -> 'claims';

  -- Fetch profile for the user
  SELECT company_id, role, onboarded, avatar_kind, initials, streak_current
  INTO v_profile
  FROM public.profiles
  WHERE id = (event ->> 'user_id')::UUID;

  IF v_profile IS NULL THEN
    RETURN event;
  END IF;

  -- Inject into app_metadata
  v_claims := jsonb_set(
    v_claims,
    '{app_metadata}',
    coalesce(v_claims -> 'app_metadata', '{}') ||
    jsonb_build_object(
      'company_id',  v_profile.company_id,
      'role',        v_profile.role,
      'onboarded',   v_profile.onboarded,
      'avatar_kind', v_profile.avatar_kind,
      'initials',    v_profile.initials,
      'streak',      v_profile.streak_current
    )
  );

  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Uppercase company code before insert/update
CREATE OR REPLACE FUNCTION normalize_company_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.code := upper(trim(NEW.code));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_company_code_upper
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION normalize_company_code();
