-- Fix profile initials trigger for INSERTs on remote UAT.
-- The original function referenced OLD before checking TG_OP, which can
-- raise on new auth users when handle_new_user inserts a profile stub.

CREATE OR REPLACE FUNCTION public.set_initials()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    NEW.initials := public.compute_initials(NEW.display_name);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
