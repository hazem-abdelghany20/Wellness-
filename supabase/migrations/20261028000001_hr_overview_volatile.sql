-- HR dashboard: "cannot execute INSERT in a read-only transaction".
--
-- hr_participation_overview() was declared STABLE, so PostgREST runs it in a
-- read-only transaction. Since 20261005000003 it calls hr_habit_challenges(),
-- which books the default week and settles finished weeks (inserts rewards and
-- notifications), so the dashboard failed whenever there was something to write.

ALTER FUNCTION public.hr_participation_overview(TEXT) VOLATILE;
