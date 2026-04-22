-- Enable Supabase Realtime on key tables
-- challenge_leaderboard_cache: live leaderboard updates
ALTER TABLE public.challenge_leaderboard_cache REPLICA IDENTITY FULL;

-- notifications: live badge count
-- (already set in migration 7, kept here for clarity)

-- Add tables to supabase_realtime publication
BEGIN;
  -- Remove if already present (idempotent)
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS
    public.challenge_leaderboard_cache,
    public.notifications,
    public.daily_plan_completions;

  ALTER PUBLICATION supabase_realtime ADD TABLE
    public.challenge_leaderboard_cache,
    public.notifications,
    public.daily_plan_completions;
COMMIT;
