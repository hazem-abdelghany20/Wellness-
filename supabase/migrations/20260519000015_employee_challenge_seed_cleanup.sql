-- Cleanup pass on challenges + leaderboard for the employee portal:
--   1. Drop three QA-test challenges that leaked into the live data.
--   2. Ensure all 6 Wellhouse demo employees are participants in the seeded
--      Sleep Sprint (only Amira was joined remotely; the other 5 never were).
--   3. Backfill challenge_leaderboard_cache for Sleep Sprint with
--      pre-anonymized rows so the leaderboard renders instead of
--      "No leaderboard data yet".
--   4. Fix lb_company_read RLS to use auth_company_id() (raw-JWT trap).

-- ── 1. Drop QA junk ────────────────────────────────────────────
DELETE FROM public.challenges
WHERE title_en IN ('QA test', 'QA chal')
   OR (title_en = '10-Day Energy Boost' AND theme IS NULL);

-- ── 2. Backfill Sleep Sprint participants ──────────────────────
-- Sleep Sprint id is fixed in the original seed; reuse it.
INSERT INTO public.challenge_participants (challenge_id, user_id, company_id, score)
SELECT
  '00000000-0000-0000-0003-000000000001'::uuid,
  p.id,
  p.company_id,
  x.score
FROM public.profiles p
JOIN (VALUES
  ('Amira Hassan',  79.5),
  ('Yusuf Naguib',  62.0),
  ('Lina Farouk',   71.0),
  ('Omar Sami',     45.5),
  ('Nadia Kamel',   88.0),
  ('Sara Anwar',    58.5)
) AS x(display_name, score) ON x.display_name = p.display_name
WHERE p.company_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (challenge_id, user_id) DO UPDATE
  SET score = EXCLUDED.score;

-- ── 3. Build the anonymized leaderboard cache ──────────────────
-- Wipe + rebuild for Sleep Sprint so re-running the migration is idempotent.
DELETE FROM public.challenge_leaderboard_cache
  WHERE challenge_id = '00000000-0000-0000-0003-000000000001'::uuid;

INSERT INTO public.challenge_leaderboard_cache
  (challenge_id, company_id, rank, display_name, avatar_kind, initials, score, is_self)
SELECT
  cp.challenge_id,
  cp.company_id,
  ROW_NUMBER() OVER (ORDER BY cp.score DESC, p.display_name) AS rank,
  -- Pre-anonymized: only first initial + last initial, never the full name.
  -- The Edge Function that refreshes this cache flips is_self per request;
  -- this seed always leaves is_self = false (no caller context).
  COALESCE(
    NULLIF(SUBSTR(p.display_name, 1, 1), '') || '.' ||
    NULLIF(SUBSTR(SPLIT_PART(p.display_name, ' ', 2), 1, 1), '') || '.',
    'Anonymous'
  ) AS display_name,
  COALESCE(p.avatar_kind, 'monogram') AS avatar_kind,
  COALESCE(
    NULLIF(SUBSTR(p.display_name, 1, 1), '') ||
    COALESCE(NULLIF(SUBSTR(SPLIT_PART(p.display_name, ' ', 2), 1, 1), ''), ''),
    '?'
  ) AS initials,
  cp.score,
  false
FROM public.challenge_participants cp
JOIN public.profiles p ON p.id = cp.user_id
WHERE cp.challenge_id = '00000000-0000-0000-0003-000000000001'::uuid;

-- ── 4. Leaderboard read policy via helper ──────────────────────
-- The original policy compared the row's company_id to raw JWT app_metadata
-- which is null/stale for fresh signups (same trap as checkins).
DROP POLICY IF EXISTS "lb_company_read" ON public.challenge_leaderboard_cache;
CREATE POLICY "lb_company_read" ON public.challenge_leaderboard_cache
  FOR SELECT USING (
    company_id = public.auth_company_id()
  );
