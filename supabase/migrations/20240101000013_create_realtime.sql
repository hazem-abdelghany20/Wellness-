-- Enable Supabase Realtime on key tables
-- challenge_leaderboard_cache: live leaderboard updates
ALTER TABLE public.challenge_leaderboard_cache REPLICA IDENTITY FULL;

-- notifications: live badge count
-- (already set in migration 7, kept here for clarity)

-- Add tables to supabase_realtime publication (idempotent per-table).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'public.challenge_leaderboard_cache',
    'public.notifications',
    'public.daily_plan_completions'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE %s', t);
    EXCEPTION WHEN undefined_object THEN
      -- table wasn't in the publication; ignore
      NULL;
    END;
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %s', t);
  END LOOP;
END $$;
