# Wellness+ HR Portal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [docs/superpowers/specs/2026-04-30-hr-portal-design.md](../specs/2026-04-30-hr-portal-design.md)

**Goal:** Wire `hr.html` to Supabase as a single-company HR portal with aggregate-only reads (5-respondent privacy floor), refactor `src/main-hr.jsx` into per-view modules under `src/hr/`, and add the HR-specific backend pieces (overview/drilldown RPCs, schedule-broadcast and export-report edge functions, daily cron for `compute-hr-aggregates`, seed `hr_admin` users).

**Architecture:** Backend additions land first (Phase 0). Frontend refactor follows the same pattern as the Employee app: verbatim extraction (Phase 1), client wrapper (Phase 2), Auth + AppConfig contexts (Phase 3), per-view data hooks with TDD (Phase 4), wire each view (Phase 5). All HR queries filter on `auth.jwt() ->> company_id` via RLS. HR users never read individual `checkins`/`content_progress`/`challenge_activities` rows — only `hr_weekly_aggregates`.

**Tech Stack:** React 18, Vite 6, Supabase (Postgres + Auth + Edge Functions + Realtime + Storage + Scheduled Functions), `@supabase/supabase-js` v2, Vitest + @testing-library/react.

**Depends on:** Employee App sub-project — Phase 0 (cloud project, base migrations, base edge functions, custom-access-token-hook, email OTP) must be complete. Vitest and the bundle's three-entry build are also reused.

**Out of scope (per spec):** Admin Console wiring, multi-company switching, real broadcast delivery (push/email send), bulk roster import.

---

## File Structure

```
src/
  main-hr.jsx                       # entry — imports App, mounts root (~5 lines)
  lib/
    supabase.ts                     # existing — untouched in this plan
    supabase-hr.ts                  # new — HR client wrapper
  hr/
    App.jsx                         # shell + routing + Tweaks
    tokens.jsx                      # HR_THEMES, DENSITY, HR_STRINGS
    components.jsx                  # HRIcon, HRButton, Panel, PanelHeader,
                                    #   Badge, Delta, Spark, TrendChart, Bullet,
                                    #   AvatarMark, Toggle
    sections.jsx                    # Sidebar, TopBar, KpiStrip, TrendsCard,
                                    #   AtRisk, TeamTable, SafetyQueue,
                                    #   Broadcasts, ContentPins, ChallengesCard,
                                    #   PeopleYouManage
    tweaks-panel.jsx                # dev-only Tweaks panel
    state/
      auth-context.jsx              # session, profile, company, role
      app-config-context.jsx        # theme, lang, density, chartStyle, layout
    hooks/
      use-overview.js               # KPIs + headline trend
      use-teams.js                  # team aggregates + drilldown
      use-people.js                 # roster (no individual signals)
      use-safety.js                 # safety queue + risk flags
      use-content.js                # content library + assignments
      use-challenges.js             # active + scheduled challenges
      use-broadcasts.js             # queue, scheduled, sent
      use-reports.js                # CSV export jobs
      use-settings.js               # company config
      __tests__/
        use-overview.test.js
        use-teams.test.js
        use-people.test.js
        use-safety.test.js
        use-content.test.js
        use-challenges.test.js
        use-broadcasts.test.js
        use-reports.test.js
        use-settings.test.js
    views/
      overview.jsx                  # Dashboard view
      teams.jsx                     # HRTeamsPage
      teams-drawer.jsx              # TeamDrawer
      people.jsx                    # HRPeoplePage
      safety.jsx                    # HRSafetyPage
      content.jsx                   # HRContentPage
      challenges.jsx                # HRChallengesPage
      broadcasts.jsx                # HRBroadcastsPage
      reports.jsx                   # HRReportsPage
      settings.jsx                  # HRSettingsPage
      access-denied.jsx             # role check fallback
```

`src/main-hr.jsx` shrinks from 2,080 lines to ~5 lines.

`supabase/`:
- New migration: `20240101000015_hr_team_overview_and_rpcs.sql`
- New migration: `20240101000016_hr_seed_admin_users.sql` (dev-only seed; gated by environment)
- New edge functions: `supabase/functions/hr-schedule-broadcast/`, `supabase/functions/hr-export-report/`

---

## Phase 0 — HR-specific backend additions

This phase assumes the Employee sub-project's Phase 0 is complete (cloud
project linked, 14 base migrations applied, base 8 edge functions
deployed, email OTP enabled, custom access token hook enabled, demo
companies seeded).

### Task 0.1: Verify the privacy floor in `hr_weekly_aggregates`

**Files:** none (read-only audit).

- [ ] **Step 1: Confirm the migration's table + policy**

In the dashboard SQL editor:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'hr_weekly_aggregates'
ORDER BY ordinal_position;
```

Expected columns include `respondent_count` (or similar) — needed for the
5-respondent floor.

- [ ] **Step 2: Confirm `hr_agg_admin_read` policy exists**

```sql
SELECT polname, polqual::text FROM pg_policy
WHERE polrelid = 'public.hr_weekly_aggregates'::regclass;
```

Expected: a row named `hr_agg_admin_read` whose `polqual` filters by
`auth.jwt() ->> 'app_metadata' ->> 'role' IN ('hr_admin', 'company_admin')`
AND `company_id = (auth.jwt() ->> 'app_metadata' ->> 'company_id')::uuid`.

- [ ] **Step 3: Capture findings as comments in the next migration**

If either check reveals a gap (e.g., the policy doesn't filter by
`company_id`), note it inline in the migration created in Task 0.2 so
the engineer fixes it as part of the same change. Do NOT silently fix
the existing migration — the canonical record is the migration history.

### Task 0.2: New migration — `hr_team_overview` view + HR RPCs

**Files:**
- Create: `supabase/migrations/20240101000015_hr_team_overview_and_rpcs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- HR team overview view + RPCs for the HR Portal.
-- Aggregates only — never expose individual rows.
-- 5-respondent privacy floor enforced inline (NULL out values when below).

-- View: per-team rollup joined with team metadata
CREATE OR REPLACE VIEW public.hr_team_overview AS
SELECT
  a.company_id,
  a.team_id,
  a.week_start,
  t.name           AS team_name,
  t.department     AS team_department,
  CASE WHEN a.respondent_count >= 5 THEN a.avg_sleep   ELSE NULL END AS avg_sleep,
  CASE WHEN a.respondent_count >= 5 THEN a.avg_stress  ELSE NULL END AS avg_stress,
  CASE WHEN a.respondent_count >= 5 THEN a.avg_energy  ELSE NULL END AS avg_energy,
  CASE WHEN a.respondent_count >= 5 THEN a.avg_mood    ELSE NULL END AS avg_mood,
  CASE WHEN a.respondent_count >= 5 THEN a.respondent_count ELSE NULL END AS respondent_count,
  a.respondent_count >= 5 AS has_signal
FROM public.hr_weekly_aggregates a
LEFT JOIN public.teams t ON t.id = a.team_id;

GRANT SELECT ON public.hr_team_overview TO authenticated;

-- RLS-equivalent: the underlying table policy already gates by role + company_id.
-- The view is invoker rights, so the gate cascades.

-- RPC: company-wide overview KPIs for a range
CREATE OR REPLACE FUNCTION public.hr_company_overview(p_range TEXT DEFAULT '30d')
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_company_id UUID;
  v_role       TEXT;
  v_from       DATE;
  v_result     JSONB;
BEGIN
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID;
  v_role       := auth.jwt() -> 'app_metadata' ->> 'role';

  IF v_role NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_from := current_date - CASE p_range
    WHEN '7d'  THEN INTERVAL '7  days'
    WHEN '30d' THEN INTERVAL '30 days'
    WHEN '90d' THEN INTERVAL '90 days'
    ELSE              INTERVAL '30 days'
  END;

  WITH company_rows AS (
    SELECT week_start,
           SUM(respondent_count)             AS respondents,
           AVG(avg_sleep)                    AS avg_sleep,
           AVG(avg_stress)                   AS avg_stress,
           AVG(avg_energy)                   AS avg_energy,
           AVG(avg_mood)                     AS avg_mood
    FROM public.hr_weekly_aggregates
    WHERE company_id = v_company_id
      AND team_id IS NULL
      AND week_start >= v_from
    GROUP BY week_start
    ORDER BY week_start
  )
  SELECT jsonb_build_object(
    'range',      p_range,
    'kpis',       jsonb_build_object(
      'avg_sleep',   ROUND(AVG(avg_sleep)::NUMERIC, 1),
      'avg_stress',  ROUND(AVG(avg_stress)::NUMERIC, 1),
      'avg_energy',  ROUND(AVG(avg_energy)::NUMERIC, 1),
      'avg_mood',    ROUND(AVG(avg_mood)::NUMERIC, 1),
      'respondents', SUM(respondents)
    ),
    'trend',      (
      SELECT jsonb_agg(jsonb_build_object(
        'week_start', cr.week_start,
        'avg_mood',   ROUND(cr.avg_mood::NUMERIC, 2),
        'avg_stress', ROUND(cr.avg_stress::NUMERIC, 2)
      ) ORDER BY cr.week_start)
      FROM company_rows cr
    )
  ) INTO v_result
  FROM company_rows;

  RETURN COALESCE(v_result, jsonb_build_object('range', p_range, 'kpis', '{}'::jsonb, 'trend', '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.hr_company_overview TO authenticated;

-- RPC: per-team time series
CREATE OR REPLACE FUNCTION public.hr_team_drilldown(p_team_id UUID, p_range TEXT DEFAULT '30d')
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_company_id UUID;
  v_role       TEXT;
  v_from       DATE;
  v_result     JSONB;
BEGIN
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID;
  v_role       := auth.jwt() -> 'app_metadata' ->> 'role';

  IF v_role NOT IN ('hr_admin', 'company_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Enforce the team belongs to the caller's company
  IF NOT EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = p_team_id AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'forbidden_team';
  END IF;

  v_from := current_date - CASE p_range
    WHEN '7d'  THEN INTERVAL '7  days'
    WHEN '30d' THEN INTERVAL '30 days'
    WHEN '90d' THEN INTERVAL '90 days'
    ELSE              INTERVAL '30 days'
  END;

  SELECT jsonb_build_object(
    'team_id',  p_team_id,
    'range',    p_range,
    'rows',     COALESCE(jsonb_agg(jsonb_build_object(
      'week_start',       v.week_start,
      'avg_sleep',        v.avg_sleep,
      'avg_stress',       v.avg_stress,
      'avg_energy',       v.avg_energy,
      'avg_mood',         v.avg_mood,
      'respondent_count', v.respondent_count,
      'has_signal',       v.has_signal
    ) ORDER BY v.week_start), '[]'::jsonb)
  ) INTO v_result
  FROM public.hr_team_overview v
  WHERE v.company_id = v_company_id
    AND v.team_id    = p_team_id
    AND v.week_start >= v_from;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hr_team_drilldown TO authenticated;
```

- [ ] **Step 2: Push the migration**

```bash
supabase db push
```

Expected: 1 new migration applied. No errors.

- [ ] **Step 3: Verify with a smoke query**

In dashboard SQL (after temporarily promoting your test user — see Task
0.4):

```sql
SELECT public.hr_company_overview('30d');
```

Expected: a JSON object with `range`, `kpis`, `trend` keys.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20240101000015_hr_team_overview_and_rpcs.sql
git commit -m "feat(supabase): hr_team_overview view + hr_company_overview/hr_team_drilldown RPCs"
```

### Task 0.3: New edge function — `hr-schedule-broadcast`

**Files:**
- Create: `supabase/functions/hr-schedule-broadcast/index.ts`

- [ ] **Step 1: Write the function**

```ts
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

interface BroadcastPayload {
  title_en: string;
  title_ar?: string;
  body_en: string;
  body_ar?: string;
  scope: 'all' | 'team';
  team_id?: string;
  scheduled_at: string;  // ISO timestamp
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { role, companyId, userId } = await requireAuth(req);

    if (!['hr_admin', 'company_admin'].includes(role)) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json() as BroadcastPayload;

    if (!payload.title_en || !payload.body_en || !payload.scheduled_at) {
      return new Response(JSON.stringify({ error: 'invalid_payload' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createServiceClient();

    // If team-scoped, verify team belongs to caller's company
    if (payload.scope === 'team') {
      if (!payload.team_id) {
        return new Response(JSON.stringify({ error: 'team_id_required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: team } = await supabase.from('teams')
        .select('id').eq('id', payload.team_id).eq('company_id', companyId).maybeSingle();
      if (!team) {
        return new Response(JSON.stringify({ error: 'team_not_in_company' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data, error } = await supabase.from('broadcasts').insert({
      company_id: companyId,
      created_by: userId,
      title_en: payload.title_en,
      title_ar: payload.title_ar ?? null,
      body_en:  payload.body_en,
      body_ar:  payload.body_ar ?? null,
      scope:    payload.scope,
      team_id:  payload.scope === 'team' ? payload.team_id : null,
      scheduled_at: payload.scheduled_at,
      status:   'scheduled',
    }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ broadcast: data }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Add a `broadcasts` table migration if it doesn't exist**

In dashboard SQL editor first check:

```sql
SELECT to_regclass('public.broadcasts');
```

If `NULL`, create migration `20240101000017_create_broadcasts.sql`:

```sql
CREATE TABLE public.broadcasts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  title_en      TEXT NOT NULL,
  title_ar      TEXT,
  body_en       TEXT NOT NULL,
  body_ar       TEXT,
  scope         TEXT NOT NULL CHECK (scope IN ('all', 'team')),
  team_id       UUID REFERENCES public.teams(id),
  scheduled_at  TIMESTAMPTZ NOT NULL,
  sent_at       TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_broadcasts_company  ON public.broadcasts(company_id, scheduled_at DESC);
CREATE INDEX idx_broadcasts_status   ON public.broadcasts(status, scheduled_at) WHERE status = 'scheduled';

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broadcast_admin_read" ON public.broadcasts
  FOR SELECT TO authenticated USING (
    company_id = ((auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid)
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('hr_admin', 'company_admin')
  );

CREATE POLICY "broadcast_service_write" ON public.broadcasts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

Push: `supabase db push`.

- [ ] **Step 3: Deploy the edge function**

```bash
supabase functions deploy hr-schedule-broadcast
```

Expected: `Deployed Function hr-schedule-broadcast`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/hr-schedule-broadcast/ supabase/migrations/20240101000017_create_broadcasts.sql
git commit -m "feat(supabase): hr-schedule-broadcast edge function + broadcasts table"
```

### Task 0.4: New edge function — `hr-export-report`

**Files:**
- Create: `supabase/functions/hr-export-report/index.ts`

- [ ] **Step 1: Write the function**

```ts
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

interface ExportPayload {
  kind: 'overview' | 'teams';
  range: '7d' | '30d' | '90d';
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { role, companyId } = await requireAuth(req);

    if (!['hr_admin', 'company_admin'].includes(role)) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json() as ExportPayload;
    const supabase = createServiceClient();

    let csv = '';
    if (payload.kind === 'overview') {
      const { data: rows } = await supabase
        .rpc('hr_company_overview_rows', { p_range: payload.range })
        .single();
      // The RPC may not exist yet; if not, build CSV from the JSON RPC instead.
      // Fall back: call hr_company_overview and serialize.
      // (Plan note: the engineer should add hr_company_overview_rows in the same
      // migration as 0.2 if a row-shape export is desired. For now, serialize JSON.)
      if (!rows) {
        const { data: jsonObj, error } = await supabase.rpc('hr_company_overview', { p_range: payload.range });
        if (error) throw error;
        const trend = jsonObj?.trend ?? [];
        csv = 'week_start,avg_mood,avg_stress\n' +
              trend.map((r: any) => `${r.week_start},${r.avg_mood},${r.avg_stress}`).join('\n');
      } else {
        csv = JSON.stringify(rows);
      }
    } else if (payload.kind === 'teams') {
      const { data: teamRows, error } = await supabase
        .from('hr_team_overview')
        .select('team_id, team_name, week_start, avg_sleep, avg_stress, avg_energy, avg_mood, respondent_count, has_signal')
        .eq('company_id', companyId)
        .gte('week_start', new Date(Date.now() - daysFromRange(payload.range) * 86400000).toISOString().slice(0, 10))
        .order('week_start');
      if (error) throw error;
      csv = 'team_id,team_name,week_start,avg_sleep,avg_stress,avg_energy,avg_mood,respondent_count,has_signal\n' +
        (teamRows ?? []).map((r) =>
          [r.team_id, csvEscape(r.team_name), r.week_start, r.avg_sleep, r.avg_stress, r.avg_energy, r.avg_mood, r.respondent_count, r.has_signal].join(',')
        ).join('\n');
    } else {
      return new Response(JSON.stringify({ error: 'invalid_kind' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const path = `reports/${companyId}/${payload.kind}-${payload.range}-${Date.now()}.csv`;
    const { error: upErr } = await supabase.storage.from('company-assets').upload(path, csv, {
      contentType: 'text/csv',
      upsert: true,
    });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await supabase.storage.from('company-assets')
      .createSignedUrl(path, 60 * 10);
    if (signErr) throw signErr;

    return new Response(JSON.stringify({ url: signed.signedUrl, path }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function daysFromRange(r: string): number {
  return r === '7d' ? 7 : r === '90d' ? 90 : 30;
}

function csvEscape(v: string | null): string {
  if (v == null) return '';
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy hr-export-report
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/hr-export-report/
git commit -m "feat(supabase): hr-export-report edge function (CSV via signed URL)"
```

### Task 0.5: Schedule `compute-hr-aggregates` daily

**Files:** none (dashboard config).

- [ ] **Step 1: Open Scheduled Functions in the dashboard**

Dashboard → Database → Cron / Scheduled Functions → New schedule.

- [ ] **Step 2: Configure**

- **Name:** `daily-hr-aggregates`
- **Schedule:** `15 1 * * *` (01:15 UTC daily)
- **Function:** `compute-hr-aggregates`
- **HTTP method:** `POST`
- **Headers:** include `Authorization: Bearer <SERVICE_ROLE_KEY>` so the
  function's `requireAuth` accepts the call. (The function expects a
  user JWT today; for the cron path, prefer a `cron_secret` header
  instead of `Authorization` and update the function's auth check —
  noted as a follow-up in the spec but acceptable to ship with the
  service role key for now.)

Save.

- [ ] **Step 3: Verify the schedule lands**

```sql
SELECT * FROM cron.job WHERE jobname = 'daily-hr-aggregates';
```

Expected: 1 row.

### Task 0.6: Seed `hr_admin` users for development

**Files:**
- Create: `supabase/migrations/20240101000016_hr_seed_admin_users.sql` (only the schema bits — see step 1)
- Manual: dashboard / psql commands to update auth metadata

- [ ] **Step 1: Identify two real test emails**

Choose two emails you control — one for Wellhouse Group, one for Nile
Group. Note them as `<EMAIL_WH>` and `<EMAIL_NG>`.

- [ ] **Step 2: Create the test users via the auth API (dashboard)**

Dashboard → Authentication → Users → Add user → "Create new user". Use
the chosen emails; check "Auto Confirm User". Capture each user's UUID.

- [ ] **Step 3: Promote each user to `hr_admin` via SQL**

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'role',       'hr_admin',
  'company_id', '00000000-0000-0000-0000-000000000001'
)
WHERE email = '<EMAIL_WH>';

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'role',       'hr_admin',
  'company_id', '00000000-0000-0000-0000-000000000002'
)
WHERE email = '<EMAIL_NG>';
```

- [ ] **Step 4: Force a token refresh**

The user must sign out and sign in again for the new role to land in
their JWT. (The custom access token hook reads `app_metadata` on every
mint.)

- [ ] **Step 5: Confirm**

After signing in, in the dashboard SQL editor:

```sql
SELECT email, raw_app_meta_data FROM auth.users
WHERE email IN ('<EMAIL_WH>', '<EMAIL_NG>');
```

Expected: each has `"role": "hr_admin"` and a `company_id`.

This step is **manual + irreversible**, so no commit. Document the SQL
in a README under `supabase/dev-notes.md` so it can be re-run if needed:

```bash
mkdir -p supabase
cat > supabase/dev-notes.md <<'EOF'
# Dev-only seed: HR admin users

After creating the two test users via Auth → Users, run the SQL in
docs/superpowers/plans/2026-04-30-hr-portal-implementation.md Task 0.6
to promote them to hr_admin. This is dev-only and does NOT belong in a
versioned migration.
EOF

git add supabase/dev-notes.md
git commit -m "docs(supabase): note dev-only HR admin seed procedure"
```

---

## Phase 1 — Verbatim frontend extraction

Move every block out of `src/main-hr.jsx` (2,080 lines) into its target
module without changing any code beyond imports/exports and verbatim
preservation of `Object.assign(window, ...)` calls. Keep the build green
after every task.

### Task 1.1: Create the directory tree

**Files:** none (empty directories don't commit; placeholder for the
following tasks).

- [ ] **Step 1: Make directories**

```bash
mkdir -p src/hr/state src/hr/hooks/__tests__ src/hr/views
```

- [ ] **Step 2: Sanity check**

```bash
ls -la src/hr/
```

Expected: 3 sub-directories.

### Task 1.2: Extract `tokens.jsx`

**Files:**
- Create: `src/hr/tokens.jsx`
- Modify: `src/main-hr.jsx`

Block: from `// --- hr-tokens.jsx ---` (line ~3) to the line before
`// --- hr-components.jsx ---`. Contains `HR_THEMES`, `DENSITY`,
`HR_STRINGS`, plus an `Object.assign(window, ...)` line.

- [ ] **Step 1: Create file**

```jsx
import React from 'react';

// (paste the verbatim block — every line from `// --- hr-tokens.jsx ---`
// through and including `Object.assign(window, { HR_THEMES, DENSITY, HR_STRINGS });`)

export { HR_THEMES, DENSITY, HR_STRINGS };
```

- [ ] **Step 2: Modify `src/main-hr.jsx`**

Add at top (after the existing `import React`/`ReactDOM`):

```jsx
import { HR_THEMES, DENSITY, HR_STRINGS } from './hr/tokens.jsx';
```

Delete the moved block.

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/hr/tokens.jsx src/main-hr.jsx
git commit -m "refactor(hr): extract tokens.jsx from bundle"
```

### Task 1.3: Extract `components.jsx`

**Files:**
- Create: `src/hr/components.jsx`
- Modify: `src/main-hr.jsx`

Block: from `// --- hr-components.jsx ---` to the line before
`// --- hr-sections.jsx ---`. Contains `HRIcon`, `HRButton`, `Panel`,
`PanelHeader`, `Badge`, `Delta`, `Spark`, `TrendChart`, `Bullet`,
`AvatarMark`, `Toggle`, plus an `Object.assign(window, ...)`.

- [ ] **Step 1: Create file**

```jsx
import React from 'react';

// (paste the verbatim block including the Object.assign at the bottom)

export {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
};
```

- [ ] **Step 2: Update `main-hr.jsx`**

```jsx
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from './hr/components.jsx';
```

Delete the moved block.

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/hr/components.jsx src/main-hr.jsx
git commit -m "refactor(hr): extract components.jsx from bundle"
```

### Task 1.4: Extract `sections.jsx`

**Files:**
- Create: `src/hr/sections.jsx`
- Modify: `src/main-hr.jsx`

Block: from `// --- hr-sections.jsx ---` to the line before
`// --- hr-views.jsx ---`. Contains `Sidebar`, `TopBar`, `KpiStrip`,
`TrendsCard`, `AtRisk`, `TeamTable`, `SafetyQueue`, `Broadcasts`,
`ContentPins`, `ChallengesCard`, `PeopleYouManage`.

- [ ] **Step 1: Create file**

```jsx
import React from 'react';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from './components.jsx';

// (paste the verbatim block including any Object.assign at the bottom)

export {
  Sidebar, TopBar, KpiStrip, TrendsCard, AtRisk, TeamTable, SafetyQueue,
  Broadcasts, ContentPins, ChallengesCard, PeopleYouManage,
};
```

- [ ] **Step 2: Update `main-hr.jsx`**

```jsx
import {
  Sidebar, TopBar, KpiStrip, TrendsCard, AtRisk, TeamTable, SafetyQueue,
  Broadcasts, ContentPins, ChallengesCard, PeopleYouManage,
} from './hr/sections.jsx';
```

Delete the moved block.

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/hr/sections.jsx src/main-hr.jsx
git commit -m "refactor(hr): extract sections.jsx from bundle"
```

### Task 1.5: Extract each view into `src/hr/views/<name>.jsx`

**Files:**
- Create: `src/hr/views/teams.jsx`, `people.jsx`, `safety.jsx`,
  `content.jsx`, `challenges.jsx`, `broadcasts.jsx`, `reports.jsx`,
  `settings.jsx`
- Modify: `src/main-hr.jsx`

The block in the bundle (`// --- hr-views.jsx ---`) contains:
`HRPageHeader`, `HRTeamsPage`, `HRPeoplePage`, `HRSafetyPage`,
`HRContentPage`, `HRChallengesPage`, `HRBroadcastsPage`, `HRReportsPage`,
`HRSettingsPage`. Plus an `Object.assign(window, ...)` at the end.

`HRPageHeader` is shared by every view. Move it into `src/hr/views/_header.jsx`:

```jsx
import React from 'react';

// (paste HRPageHeader)

export { HRPageHeader };
```

Then for each page function, create a separate file. Example for `teams.jsx`:

```jsx
import React from 'react';
import { HRPageHeader } from './_header.jsx';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from '../components.jsx';

// (paste HRTeamsPage and any helpers private to it)

export { HRTeamsPage };
```

Repeat for each page. Identify helpers used only inside one page (e.g.,
small private subcomponents) and keep them inside that page's file.

- [ ] **Step 1: Create `src/hr/views/_header.jsx`** with `HRPageHeader`.

- [ ] **Step 2: Create one view file per page** in this order: teams,
  people, safety, content, challenges, broadcasts, reports, settings.

  Each file imports `HRPageHeader` from `./_header.jsx` and the needed
  symbols from `../components.jsx`. Verbatim block, then export the page
  function.

- [ ] **Step 3: Update `main-hr.jsx`** with the imports:

```jsx
import { HRPageHeader }       from './hr/views/_header.jsx';
import { HRTeamsPage }        from './hr/views/teams.jsx';
import { HRPeoplePage }       from './hr/views/people.jsx';
import { HRSafetyPage }       from './hr/views/safety.jsx';
import { HRContentPage }      from './hr/views/content.jsx';
import { HRChallengesPage }   from './hr/views/challenges.jsx';
import { HRBroadcastsPage }   from './hr/views/broadcasts.jsx';
import { HRReportsPage }      from './hr/views/reports.jsx';
import { HRSettingsPage }     from './hr/views/settings.jsx';
```

Delete the entire `// --- hr-views.jsx ---` block.

- [ ] **Step 4: Build clean**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/hr/views/ src/main-hr.jsx
git commit -m "refactor(hr): extract per-view files (teams/people/safety/content/challenges/broadcasts/reports/settings)"
```

### Task 1.6: Extract Tweaks panel

**Files:**
- Create: `src/hr/tweaks-panel.jsx`
- Modify: `src/main-hr.jsx`

The `TweaksPanel` lives inside the `// --- hr-app.jsx ---` block. Move
just `TweaksPanel` (and its private helpers if any).

- [ ] **Step 1: Create file**

```jsx
import React from 'react';
import { HRIcon } from './components.jsx';

// (paste TweaksPanel + private helpers)

export { TweaksPanel };
```

- [ ] **Step 2: Update `main-hr.jsx`**

```jsx
import { TweaksPanel } from './hr/tweaks-panel.jsx';
```

Delete the function from the bundle.

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/hr/tweaks-panel.jsx src/main-hr.jsx
git commit -m "refactor(hr): extract tweaks-panel"
```

### Task 1.7: Extract `App.jsx`

**Files:**
- Create: `src/hr/App.jsx`
- Modify: `src/main-hr.jsx`

The remaining content of `main-hr.jsx` after Task 1.6 is: imports,
`TeamDrawer`, `Dashboard`, `HRApp`, plus the `ReactDOM.createRoot(...)`
call.

- [ ] **Step 1: Create `src/hr/App.jsx`**

Move the imports + `TeamDrawer` + `Dashboard` + `HRApp` into this file.
Update import paths since the file lives one directory up:
- `'./hr/tokens.jsx'` → `'./tokens.jsx'`
- `'./hr/components.jsx'` → `'./components.jsx'`
- `'./hr/sections.jsx'` → `'./sections.jsx'`
- `'./hr/tweaks-panel.jsx'` → `'./tweaks-panel.jsx'`
- `'./hr/views/...'` → `'./views/...'`

Add at the bottom:

```jsx
export default HRApp;
```

Move `TeamDrawer` to a new file `src/hr/views/teams-drawer.jsx`:

```jsx
import React from 'react';
import {
  HRIcon, HRButton, Panel, PanelHeader, Badge, Delta, Spark, TrendChart,
  Bullet, AvatarMark, Toggle,
} from '../components.jsx';

// (paste TeamDrawer)

export { TeamDrawer };
```

Then `App.jsx` imports it:

```jsx
import { TeamDrawer } from './views/teams-drawer.jsx';
```

- [ ] **Step 2: Replace `src/main-hr.jsx` with entry-only content**

```jsx
import React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './hr/App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

- [ ] **Step 3: Build + dev smoke**

```bash
npm run build
npm run dev &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/hr.html
pkill -f vite 2>/dev/null
```

Expected: 200.

- [ ] **Step 4: Commit**

```bash
git add src/hr/App.jsx src/hr/views/teams-drawer.jsx src/main-hr.jsx
git commit -m "refactor(hr): extract App.jsx and teams-drawer.jsx; main-hr is entry only"
```

### Task 1.8: Gate Tweaks panel behind `?tweaks=1` / DEV

**Files:**
- Modify: `src/hr/App.jsx`

Same pattern as the Employee app. Add inside `HRApp`:

```jsx
const tweaksAvailable = import.meta.env.DEV ||
  new URLSearchParams(window.location.search).get('tweaks') === '1';
```

Wrap the `<TweaksPanel ... />` render and any visible toggle button in
`{tweaksAvailable && ...}`. The HR shell's `TopBar` likely has an
`onTweaks` prop — gate that affordance too.

- [ ] **Step 1: Add the gate**

- [ ] **Step 2: Build + preview smoke**

```bash
npm run build
npm run preview &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/hr.html
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:4173/hr.html?tweaks=1"
pkill -f "vite preview" 2>/dev/null
```

Both 200.

- [ ] **Step 3: Commit**

```bash
git add src/hr/App.jsx
git commit -m "feat(hr): gate Tweaks panel behind ?tweaks=1 in prod"
```

---

## Phase 2 — HR client wrapper

### Task 2.1: Create `src/lib/supabase-hr.ts`

**Files:**
- Create: `src/lib/supabase-hr.ts`

The HR-specific helpers. Reuses the same `supabase` client from
`./supabase.ts`.

- [ ] **Step 1: Write the file**

```ts
import { supabase } from './supabase';

// ── Overview ───────────────────────────────────────────────────

export async function getCompanyOverview(range: '7d' | '30d' | '90d' = '30d') {
  const { data, error } = await supabase.rpc('hr_company_overview', { p_range: range });
  if (error) throw error;
  return data as {
    range: string;
    kpis: Record<string, number>;
    trend: Array<{ week_start: string; avg_mood: number; avg_stress: number }>;
  };
}

// ── Teams ──────────────────────────────────────────────────────

export async function getTeamAggregates() {
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = user?.app_metadata?.company_id as string | undefined;
  if (!companyId) throw new Error('not_in_company');

  const { data, error } = await supabase
    .from('hr_team_overview')
    .select('*')
    .eq('company_id', companyId)
    .order('week_start', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTeamDrilldown(teamId: string, range: '7d' | '30d' | '90d' = '30d') {
  const { data, error } = await supabase.rpc('hr_team_drilldown', { p_team_id: teamId, p_range: range });
  if (error) throw error;
  return data as { team_id: string; range: string; rows: any[] };
}

// ── People ─────────────────────────────────────────────────────

export async function getRoster() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_kind, role, team_id, teams(name, department)')
    .order('display_name');
  if (error) throw error;
  return data ?? [];
}

// ── Content ────────────────────────────────────────────────────

export async function getContentLibrary() {
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('published', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function assignContent(contentId: string, scope: 'all' | 'team', teamId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = user?.app_metadata?.company_id as string | undefined;
  if (!companyId) throw new Error('not_in_company');

  const { data, error } = await supabase.from('content_assignments').insert({
    company_id: companyId,
    content_id: contentId,
    scope,
    team_id: scope === 'team' ? teamId : null,
    assigned_by: user!.id,
  }).select().single();
  if (error) throw error;
  return data;
}

// ── Challenges ─────────────────────────────────────────────────

export async function listChallengeTemplates() {
  // The Admin sub-project introduces challenge_templates; for now,
  // return active challenges as templates. The Admin spec replaces this.
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function scheduleChallenge(template: any, window: { start: string; end: string }, scope: 'all' | 'team', teamId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = user?.app_metadata?.company_id as string | undefined;
  if (!companyId) throw new Error('not_in_company');

  const { data, error } = await supabase.from('challenges').insert({
    company_id: companyId,
    title:        template.title,
    description:  template.description,
    kind:         template.kind ?? 'team',
    metric:       template.metric ?? 'checkins',
    target:       template.target ?? 10,
    start_date:   window.start,
    end_date:     window.end,
    active:       true,
    scope:        scope,
    team_id:      scope === 'team' ? teamId : null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function getChallengeStatus(challengeId: string) {
  const { data, error } = await supabase
    .from('challenges')
    .select('*, challenge_leaderboard_cache(*)')
    .eq('id', challengeId)
    .single();
  if (error) throw error;
  return data;
}

// ── Broadcasts ─────────────────────────────────────────────────

export async function listBroadcasts() {
  const { data, error } = await supabase
    .from('broadcasts')
    .select('*')
    .order('scheduled_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function scheduleBroadcast(payload: {
  title_en: string; title_ar?: string;
  body_en:  string; body_ar?:  string;
  scope: 'all' | 'team'; team_id?: string;
  scheduled_at: string;
}) {
  const { data, error } = await supabase.functions.invoke('hr-schedule-broadcast', { body: payload });
  if (error) throw error;
  return (data as any).broadcast;
}

export async function cancelBroadcast(id: string) {
  const { error } = await supabase
    .from('broadcasts')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (error) throw error;
}

// ── Reports ────────────────────────────────────────────────────

export async function requestReportExport(kind: 'overview' | 'teams', range: '7d' | '30d' | '90d') {
  const { data, error } = await supabase.functions.invoke('hr-export-report', {
    body: { kind, range },
  });
  if (error) throw error;
  return data as { url: string; path: string };
}

// ── Settings ───────────────────────────────────────────────────

export async function getCompanySettings() {
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = user?.app_metadata?.company_id as string | undefined;
  if (!companyId) throw new Error('not_in_company');

  const { data, error } = await supabase
    .from('companies')
    .select('id, name, slug, settings')
    .eq('id', companyId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateCompanySettings(patch: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = user?.app_metadata?.company_id as string | undefined;
  if (!companyId) throw new Error('not_in_company');

  const { data, error } = await supabase
    .from('companies')
    .update(patch)
    .eq('id', companyId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Smoke compile**

```bash
npm run build
```

Expected: clean. (No screen consumes these helpers yet — Phase 5 wires
them.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase-hr.ts
git commit -m "feat(hr): add HR client wrapper (supabase-hr.ts)"
```

---

## Phase 3 — Auth + AppConfig contexts (HR variants)

### Task 3.1: HR `AppConfigContext`

**Files:**
- Create: `src/hr/state/app-config-context.jsx`
- Modify: `src/hr/App.jsx`

Same shape as the Employee context, but the HR config has different
keys (`theme`, `lang`, `density`, `chartStyle`, `layout`).

- [ ] **Step 1: Read the bundle's `TWEAK_DEFAULTS`**

In `src/hr/App.jsx`, find the `TWEAK_DEFAULTS` const that initializes
HR's `cfg` state. Note its keys and default values.

- [ ] **Step 2: Create the context**

```jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'wellness:hr-app-config';

const DEFAULTS = {
  // Mirror the bundle's TWEAK_DEFAULTS keys exactly. Common keys:
  theme:      'dark',
  lang:       'en',
  density:    'comfortable',
  layout:     'default',
  chartStyle: 'line',
};

const HRAppConfigContext = createContext(null);

export function HRAppConfigProvider({ children }) {
  const [cfg, setCfg] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch { return DEFAULTS; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
  }, [cfg]);

  const value = { cfg, setCfg, patch: (p) => setCfg(c => ({ ...c, ...p })) };
  return <HRAppConfigContext.Provider value={value}>{children}</HRAppConfigContext.Provider>;
}

export function useHRAppConfig() {
  const ctx = useContext(HRAppConfigContext);
  if (!ctx) throw new Error('useHRAppConfig must be used inside HRAppConfigProvider');
  return ctx;
}
```

- [ ] **Step 3: Wrap `HRApp` with the provider**

```jsx
import { HRAppConfigProvider, useHRAppConfig } from './state/app-config-context.jsx';

function AppInner() {
  const { cfg, setCfg } = useHRAppConfig();
  // ... existing HRApp body, replacing the local cfg useState
}

export default function App() {
  return (
    <HRAppConfigProvider>
      <AppInner />
    </HRAppConfigProvider>
  );
}
```

(Use `App` as the renamed default export; keep `HRApp` as the original
function name internally if desired.)

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add src/hr/state/app-config-context.jsx src/hr/App.jsx
git commit -m "feat(hr): HRAppConfigContext with localStorage persistence"
```

### Task 3.2: HR `AuthContext` with role gate

**Files:**
- Create: `src/hr/state/auth-context.jsx`
- Modify: `src/hr/App.jsx`

The HR auth context exposes: `session`, `profile`, `company`, `role`,
`loading`, `signIn(email)`, `verifyOtp(token)`, `signOut`,
`refreshProfile`. Sign-in is plain email OTP — no company-code step
(HR users are pre-provisioned by an admin).

- [ ] **Step 1: Create the context**

```jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  supabase, signInWithOtp, verifyOtp as verifyOtpRaw,
  signOut as signOutRaw, getMyProfile, getMyCompany,
} from '../../lib/supabase';

const HRAuthContext = createContext(null);

export function HRAuthProvider({ children }) {
  const [session, setSession]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [company, setCompany]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [pendingEmail, setPendingEmail] = useState(null);

  const role = session?.user?.app_metadata?.role || null;

  const refreshProfile = useCallback(async () => {
    if (!session) { setProfile(null); setCompany(null); return; }
    try {
      const [p, c] = await Promise.all([getMyProfile(), getMyCompany()]);
      setProfile(p); setCompany(c);
    } catch (e) {
      console.warn('[hr-auth] refreshProfile failed', e);
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  const signIn = useCallback(async (email) => {
    await signInWithOtp(email);
    setPendingEmail(email);
  }, []);

  const verifyOtp = useCallback(async (token) => {
    if (!pendingEmail) throw new Error('No pending email');
    const { data, error } = await verifyOtpRaw(pendingEmail, token);
    if (error) throw error;
    setPendingEmail(null);
    return data;
  }, [pendingEmail]);

  const signOut = useCallback(async () => {
    await signOutRaw();
    setProfile(null); setCompany(null); setPendingEmail(null);
  }, []);

  const value = { session, profile, company, role, loading, pendingEmail, signIn, verifyOtp, signOut, refreshProfile };
  return <HRAuthContext.Provider value={value}>{children}</HRAuthContext.Provider>;
}

export function useHRAuth() {
  const ctx = useContext(HRAuthContext);
  if (!ctx) throw new Error('useHRAuth must be used inside HRAuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Wrap `App` with `HRAuthProvider`**

```jsx
import { HRAuthProvider } from './state/auth-context.jsx';

export default function App() {
  return (
    <HRAppConfigProvider>
      <HRAuthProvider>
        <AppInner />
      </HRAuthProvider>
    </HRAppConfigProvider>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/hr/state/auth-context.jsx src/hr/App.jsx
git commit -m "feat(hr): HRAuthContext with role + company exposure"
```

### Task 3.3: Sign-in screen + role gate in App routing

**Files:**
- Create: `src/hr/views/sign-in.jsx`
- Create: `src/hr/views/access-denied.jsx`
- Modify: `src/hr/App.jsx`

- [ ] **Step 1: Create `sign-in.jsx`**

```jsx
import React, { useState } from 'react';
import { useHRAuth } from '../state/auth-context.jsx';
import { HRButton } from '../components.jsx';

export function SignIn({ theme, S, dir }) {
  const { signIn, verifyOtp, pendingEmail } = useHRAuth();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState(null);

  const handleSendCode = async () => {
    setErr(null); setBusy(true);
    try { await signIn(email); }
    catch (e) { setErr(e?.message || 'Failed to send code'); }
    finally { setBusy(false); }
  };

  const handleVerify = async () => {
    setErr(null); setBusy(true);
    try { await verifyOtp(token); }
    catch (e) { setErr(e?.message || 'Invalid code'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg, color: theme.text }} dir={dir}>
      <div style={{ width: 360, padding: 32, background: theme.panel, borderRadius: 16, border: `1px solid ${theme.border}` }}>
        <h1 className="display" style={{ fontSize: 24, marginBottom: 16 }}>{S?.signIn || 'HR Portal'}</h1>
        {!pendingEmail ? (
          <>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, background: theme.panelSunk, border: `1px solid ${theme.border}`, color: theme.text, marginBottom: 12 }} />
            <HRButton theme={theme} onClick={handleSendCode} disabled={busy || !email}>{busy ? 'Sending…' : (S?.sendCode || 'Send code')}</HRButton>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 12 }}>Code sent to {pendingEmail}</div>
            <input value={token} onChange={e => setToken(e.target.value)} placeholder="6-digit code" style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, background: theme.panelSunk, border: `1px solid ${theme.border}`, color: theme.text, marginBottom: 12 }} />
            <HRButton theme={theme} onClick={handleVerify} disabled={busy || token.length < 6}>{busy ? 'Verifying…' : (S?.verify || 'Verify')}</HRButton>
          </>
        )}
        {err && <div style={{ fontSize: 12, color: theme.danger || '#ff6b6b', marginTop: 12 }}>{err}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `access-denied.jsx`**

```jsx
import React from 'react';
import { useHRAuth } from '../state/auth-context.jsx';
import { HRButton } from '../components.jsx';

export function AccessDenied({ theme, dir }) {
  const { signOut } = useHRAuth();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg, color: theme.text }} dir={dir}>
      <div style={{ width: 360, padding: 32, background: theme.panel, borderRadius: 16, border: `1px solid ${theme.border}`, textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 24, marginBottom: 12 }}>No access</h1>
        <p style={{ fontSize: 14, color: theme.textMuted, marginBottom: 16 }}>
          Your account does not have HR portal access. Contact your administrator if you believe this is wrong.
        </p>
        <HRButton theme={theme} variant="secondary" onClick={signOut}>Sign out</HRButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the gate in `App.jsx`**

In `AppInner` (or whatever the inner shell function is now called):

```jsx
import { useHRAuth } from './state/auth-context.jsx';
import { SignIn } from './views/sign-in.jsx';
import { AccessDenied } from './views/access-denied.jsx';

// inside AppInner:
const { session, role, loading: authLoading } = useHRAuth();

if (authLoading) {
  return <div style={{ minHeight: '100vh', background: T.bg }}/>;
}
if (!session) {
  return <SignIn theme={T} S={S} dir={dir}/>;
}
if (!['hr_admin', 'company_admin'].includes(role)) {
  return <AccessDenied theme={T} dir={dir}/>;
}
// otherwise, render the existing HR shell
```

- [ ] **Step 4: Build + dev smoke**

```bash
npm run build
npm run dev &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/hr.html
pkill -f vite 2>/dev/null
```

Expected: 200.

- [ ] **Step 5: Commit**

```bash
git add src/hr/views/sign-in.jsx src/hr/views/access-denied.jsx src/hr/App.jsx
git commit -m "feat(hr): sign-in screen + role-based access gate"
```

---

## Phase 4 — Data hooks with TDD

Each hook follows the Employee pattern: write the failing test, run to
fail, implement minimal hook, run to pass, commit.

Mock path: from `src/hr/hooks/__tests__/`, `../../../lib/supabase-hr` reaches the
client wrapper (three levels up).

### Task 4.1: `use-overview` (TDD)

**Files:**
- Create: `src/hr/hooks/__tests__/use-overview.test.js`
- Create: `src/hr/hooks/use-overview.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  getCompanyOverview: vi.fn(),
}));

import { getCompanyOverview } from '../../../lib/supabase-hr';
import { useOverview } from '../use-overview';

beforeEach(() => {
  vi.clearAllMocks();
  getCompanyOverview.mockResolvedValue({
    range: '30d',
    kpis: { avg_mood: 7.1, avg_stress: 4.3 },
    trend: [{ week_start: '2026-04-01', avg_mood: 7.0, avg_stress: 4.4 }],
  });
});

describe('useOverview', () => {
  it('loads overview for the default range on mount', async () => {
    const { result } = renderHook(() => useOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getCompanyOverview).toHaveBeenCalledWith('30d');
    expect(result.current.data.kpis.avg_mood).toBe(7.1);
  });

  it('refetches when range changes', async () => {
    const { result, rerender } = renderHook(({ range }) => useOverview(range), { initialProps: { range: '30d' } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ range: '7d' });
    await waitFor(() => expect(getCompanyOverview).toHaveBeenCalledWith('7d'));
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
npm test src/hr/hooks/__tests__/use-overview.test.js
```

- [ ] **Step 3: Implement**

```js
import { useState, useEffect, useCallback } from 'react';
import { getCompanyOverview } from '../../lib/supabase-hr';

export function useOverview(range = '30d') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await getCompanyOverview(range)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}
```

- [ ] **Step 4: Run to pass + commit**

```bash
npm test src/hr/hooks/__tests__/use-overview.test.js
git add src/hr/hooks/use-overview.js src/hr/hooks/__tests__/use-overview.test.js
git commit -m "feat(hr): use-overview hook with tests"
```

### Task 4.2: `use-teams` (TDD)

**Files:**
- Create: `src/hr/hooks/__tests__/use-teams.test.js`
- Create: `src/hr/hooks/use-teams.js`

- [ ] **Step 1: Test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  getTeamAggregates: vi.fn(),
  getTeamDrilldown: vi.fn(),
}));

import { getTeamAggregates, getTeamDrilldown } from '../../../lib/supabase-hr';
import { useTeams } from '../use-teams';

beforeEach(() => {
  vi.clearAllMocks();
  getTeamAggregates.mockResolvedValue([
    { team_id: 't1', team_name: 'Eng', has_signal: true,  avg_mood: 7.0 },
    { team_id: 't2', team_name: 'Fin', has_signal: false, avg_mood: null },
  ]);
});

describe('useTeams', () => {
  it('loads team aggregates', async () => {
    const { result } = renderHook(() => useTeams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams).toHaveLength(2);
  });

  it('drilldown fetches for a single team', async () => {
    getTeamDrilldown.mockResolvedValue({ team_id: 't1', range: '30d', rows: [] });
    const { result } = renderHook(() => useTeams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let drill;
    await act(async () => { drill = await result.current.drilldown('t1', '30d'); });
    expect(getTeamDrilldown).toHaveBeenCalledWith('t1', '30d');
    expect(drill.team_id).toBe('t1');
  });
});
```

- [ ] **Step 2: Implement**

```js
import { useState, useEffect, useCallback } from 'react';
import { getTeamAggregates, getTeamDrilldown } from '../../lib/supabase-hr';

export function useTeams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTeams(await getTeamAggregates()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const drilldown = useCallback((teamId, range = '30d') =>
    getTeamDrilldown(teamId, range), []);

  return { teams, loading, error, drilldown, refetch };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test src/hr/hooks/__tests__/use-teams.test.js
git add src/hr/hooks/use-teams.js src/hr/hooks/__tests__/use-teams.test.js
git commit -m "feat(hr): use-teams hook with tests"
```

### Task 4.3: `use-people` (TDD)

**Files:**
- Create: `src/hr/hooks/__tests__/use-people.test.js`
- Create: `src/hr/hooks/use-people.js`

- [ ] **Step 1: Test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({ getRoster: vi.fn() }));

import { getRoster } from '../../../lib/supabase-hr';
import { usePeople } from '../use-people';

beforeEach(() => {
  vi.clearAllMocks();
  getRoster.mockResolvedValue([
    { id: 'u1', display_name: 'Alex', role: 'employee', team_id: 't1' },
  ]);
});

describe('usePeople', () => {
  it('loads roster on mount', async () => {
    const { result } = renderHook(() => usePeople());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.people).toHaveLength(1);
    expect(result.current.people[0].display_name).toBe('Alex');
  });
});
```

- [ ] **Step 2: Implement**

```js
import { useState, useEffect, useCallback } from 'react';
import { getRoster } from '../../lib/supabase-hr';

export function usePeople() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setPeople(await getRoster()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { people, loading, error, refetch };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test src/hr/hooks/__tests__/use-people.test.js
git add src/hr/hooks/use-people.js src/hr/hooks/__tests__/use-people.test.js
git commit -m "feat(hr): use-people hook with tests"
```

### Task 4.4: `use-safety` (TDD)

**Files:**
- Create: `src/hr/hooks/__tests__/use-safety.test.js`
- Create: `src/hr/hooks/use-safety.js`

The HR Safety view surfaces teams flagged "high risk" by aggregate
trends. There is no dedicated table; the data is derived from team
aggregates by filtering for descending trend or `risk` flag.

- [ ] **Step 1: Test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({ getTeamAggregates: vi.fn() }));

import { getTeamAggregates } from '../../../lib/supabase-hr';
import { useSafety } from '../use-safety';

beforeEach(() => {
  vi.clearAllMocks();
  getTeamAggregates.mockResolvedValue([
    { team_id: 't1', team_name: 'Eng', avg_stress: 7.5, has_signal: true },
    { team_id: 't2', team_name: 'Fin', avg_stress: 4.0, has_signal: true },
    { team_id: 't3', team_name: 'Tiny', has_signal: false },
  ]);
});

describe('useSafety', () => {
  it('flags teams with avg_stress >= 7 and has_signal=true as high risk', async () => {
    const { result } = renderHook(() => useSafety());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.highRisk).toHaveLength(1);
    expect(result.current.highRisk[0].team_id).toBe('t1');
  });

  it('excludes teams under the privacy floor', async () => {
    const { result } = renderHook(() => useSafety());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.highRisk.find(t => t.team_id === 't3')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement**

```js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTeamAggregates } from '../../lib/supabase-hr';

export function useSafety() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTeams(await getTeamAggregates()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const highRisk = useMemo(
    () => teams.filter(t => t.has_signal && t.avg_stress != null && t.avg_stress >= 7),
    [teams]
  );

  return { teams, highRisk, loading, error, refetch };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test src/hr/hooks/__tests__/use-safety.test.js
git add src/hr/hooks/use-safety.js src/hr/hooks/__tests__/use-safety.test.js
git commit -m "feat(hr): use-safety hook (high-risk teams) with tests"
```

### Task 4.5: `use-content` (TDD)

**Files:**
- Create: `src/hr/hooks/__tests__/use-content.test.js`
- Create: `src/hr/hooks/use-content.js`

- [ ] **Step 1: Test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  getContentLibrary: vi.fn(),
  assignContent: vi.fn(),
}));

import { getContentLibrary, assignContent } from '../../../lib/supabase-hr';
import { useContent } from '../use-content';

beforeEach(() => {
  vi.clearAllMocks();
  getContentLibrary.mockResolvedValue([{ id: 'c1', title_en: 'Sleep' }]);
});

describe('useContent (HR)', () => {
  it('loads library on mount', async () => {
    const { result } = renderHook(() => useContent());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
  });

  it('assigns content to all', async () => {
    assignContent.mockResolvedValue({ id: 'a1' });
    const { result } = renderHook(() => useContent());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.assign('c1', 'all'); });
    expect(assignContent).toHaveBeenCalledWith('c1', 'all', undefined);
  });
});
```

- [ ] **Step 2: Implement**

```js
import { useState, useEffect, useCallback } from 'react';
import { getContentLibrary, assignContent } from '../../lib/supabase-hr';

export function useContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await getContentLibrary()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const assign = useCallback((contentId, scope, teamId) =>
    assignContent(contentId, scope, teamId), []);

  return { items, loading, error, assign, refetch };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test src/hr/hooks/__tests__/use-content.test.js
git add src/hr/hooks/use-content.js src/hr/hooks/__tests__/use-content.test.js
git commit -m "feat(hr): use-content hook with tests"
```

### Task 4.6: `use-challenges` (TDD)

**Files:**
- Create: `src/hr/hooks/__tests__/use-challenges.test.js`
- Create: `src/hr/hooks/use-challenges.js`

- [ ] **Step 1: Test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  listChallengeTemplates: vi.fn(),
  scheduleChallenge: vi.fn(),
  getChallengeStatus: vi.fn(),
}));

import {
  listChallengeTemplates, scheduleChallenge, getChallengeStatus,
} from '../../../lib/supabase-hr';
import { useChallenges } from '../use-challenges';

beforeEach(() => {
  vi.clearAllMocks();
  listChallengeTemplates.mockResolvedValue([{ id: 'tpl-1', title_en: 'Move' }]);
});

describe('useChallenges (HR)', () => {
  it('loads templates on mount', async () => {
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.templates).toHaveLength(1);
  });

  it('schedules a challenge', async () => {
    scheduleChallenge.mockResolvedValue({ id: 'c1' });
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.schedule({ id: 'tpl-1' }, { start: '2026-05-01', end: '2026-05-15' }, 'all');
    });
    expect(scheduleChallenge).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```js
import { useState, useEffect, useCallback } from 'react';
import {
  listChallengeTemplates, scheduleChallenge, getChallengeStatus,
} from '../../lib/supabase-hr';

export function useChallenges() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTemplates(await listChallengeTemplates()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const schedule = useCallback(async (template, window, scope, teamId) => {
    const created = await scheduleChallenge(template, window, scope, teamId);
    await refetch();
    return created;
  }, [refetch]);

  const status = useCallback((id) => getChallengeStatus(id), []);

  return { templates, loading, error, schedule, status, refetch };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test src/hr/hooks/__tests__/use-challenges.test.js
git add src/hr/hooks/use-challenges.js src/hr/hooks/__tests__/use-challenges.test.js
git commit -m "feat(hr): use-challenges hook with tests"
```

### Task 4.7: `use-broadcasts` (TDD)

**Files:**
- Create: `src/hr/hooks/__tests__/use-broadcasts.test.js`
- Create: `src/hr/hooks/use-broadcasts.js`

- [ ] **Step 1: Test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  listBroadcasts: vi.fn(),
  scheduleBroadcast: vi.fn(),
  cancelBroadcast: vi.fn(),
}));

import {
  listBroadcasts, scheduleBroadcast, cancelBroadcast,
} from '../../../lib/supabase-hr';
import { useBroadcasts } from '../use-broadcasts';

beforeEach(() => {
  vi.clearAllMocks();
  listBroadcasts.mockResolvedValue([{ id: 'b1', status: 'scheduled' }]);
});

describe('useBroadcasts', () => {
  it('lists broadcasts on mount', async () => {
    const { result } = renderHook(() => useBroadcasts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.list).toHaveLength(1);
  });

  it('schedules a new broadcast', async () => {
    scheduleBroadcast.mockResolvedValue({ id: 'b2' });
    const { result } = renderHook(() => useBroadcasts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.schedule({ title_en: 'Hi', body_en: 'Hello', scope: 'all', scheduled_at: '2026-05-01T09:00:00Z' });
    });
    expect(scheduleBroadcast).toHaveBeenCalled();
  });

  it('cancels a broadcast', async () => {
    cancelBroadcast.mockResolvedValue();
    const { result } = renderHook(() => useBroadcasts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.cancel('b1'); });
    expect(cancelBroadcast).toHaveBeenCalledWith('b1');
  });
});
```

- [ ] **Step 2: Implement**

```js
import { useState, useEffect, useCallback } from 'react';
import { listBroadcasts, scheduleBroadcast, cancelBroadcast } from '../../lib/supabase-hr';

export function useBroadcasts() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setList(await listBroadcasts()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const schedule = useCallback(async (payload) => {
    const created = await scheduleBroadcast(payload);
    await refetch();
    return created;
  }, [refetch]);

  const cancel = useCallback(async (id) => {
    await cancelBroadcast(id);
    await refetch();
  }, [refetch]);

  return { list, loading, error, schedule, cancel, refetch };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test src/hr/hooks/__tests__/use-broadcasts.test.js
git add src/hr/hooks/use-broadcasts.js src/hr/hooks/__tests__/use-broadcasts.test.js
git commit -m "feat(hr): use-broadcasts hook with tests"
```

### Task 4.8: `use-reports` (TDD)

**Files:**
- Create: `src/hr/hooks/__tests__/use-reports.test.js`
- Create: `src/hr/hooks/use-reports.js`

- [ ] **Step 1: Test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({ requestReportExport: vi.fn() }));

import { requestReportExport } from '../../../lib/supabase-hr';
import { useReports } from '../use-reports';

beforeEach(() => { vi.clearAllMocks(); });

describe('useReports', () => {
  it('returns the signed URL after export', async () => {
    requestReportExport.mockResolvedValue({ url: 'https://example.com/r.csv', path: 'p' });
    const { result } = renderHook(() => useReports());
    let res;
    await act(async () => { res = await result.current.exportReport('overview', '30d'); });
    expect(requestReportExport).toHaveBeenCalledWith('overview', '30d');
    expect(res.url).toContain('example.com');
  });
});
```

- [ ] **Step 2: Implement**

```js
import { useState, useCallback } from 'react';
import { requestReportExport } from '../../lib/supabase-hr';

export function useReports() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastUrl, setLastUrl] = useState(null);

  const exportReport = useCallback(async (kind, range) => {
    setBusy(true); setError(null);
    try {
      const r = await requestReportExport(kind, range);
      setLastUrl(r.url);
      return r;
    } catch (e) {
      setError(e); throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  return { exportReport, busy, error, lastUrl };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test src/hr/hooks/__tests__/use-reports.test.js
git add src/hr/hooks/use-reports.js src/hr/hooks/__tests__/use-reports.test.js
git commit -m "feat(hr): use-reports hook with tests"
```

### Task 4.9: `use-settings` (TDD)

**Files:**
- Create: `src/hr/hooks/__tests__/use-settings.test.js`
- Create: `src/hr/hooks/use-settings.js`

- [ ] **Step 1: Test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({
  getCompanySettings: vi.fn(),
  updateCompanySettings: vi.fn(),
}));

import { getCompanySettings, updateCompanySettings } from '../../../lib/supabase-hr';
import { useSettings } from '../use-settings';

beforeEach(() => {
  vi.clearAllMocks();
  getCompanySettings.mockResolvedValue({ id: 'co1', name: 'Acme', settings: { locale: 'en' } });
});

describe('useSettings', () => {
  it('loads settings on mount', async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.company.name).toBe('Acme');
  });

  it('updates settings', async () => {
    updateCompanySettings.mockResolvedValue({ id: 'co1', name: 'Acme 2' });
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.update({ name: 'Acme 2' }); });
    expect(updateCompanySettings).toHaveBeenCalledWith({ name: 'Acme 2' });
  });
});
```

- [ ] **Step 2: Implement**

```js
import { useState, useEffect, useCallback } from 'react';
import { getCompanySettings, updateCompanySettings } from '../../lib/supabase-hr';

export function useSettings() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setCompany(await getCompanySettings()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const update = useCallback(async (patch) => {
    const updated = await updateCompanySettings(patch);
    setCompany(updated);
    return updated;
  }, []);

  return { company, loading, error, update, refetch };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test src/hr/hooks/__tests__/use-settings.test.js
git add src/hr/hooks/use-settings.js src/hr/hooks/__tests__/use-settings.test.js
git commit -m "feat(hr): use-settings hook with tests"
```

---

## Phase 5 — Wire each view

Each task replaces hardcoded data in a view with hook data. The
implementer reads each view, identifies the mock arrays/objects, and
swaps them for the hook's `data`/`teams`/`items` etc.

### Task 5.1: Wire Overview (Dashboard)

**Files:**
- Modify: `src/hr/App.jsx` (the `Dashboard` component, or wherever the
  overview is rendered)

```jsx
import { useOverview } from './hooks/use-overview.js';

function Dashboard({ theme, S, cfg, density, gap, layout, range, setDrawerTeam }) {
  const { data, loading } = useOverview(range);
  if (loading || !data) return <DashboardLoading theme={theme}/>;
  // pass data.kpis into KpiStrip, data.trend into TrendsCard
}
```

The existing `KpiStrip`, `TrendsCard`, `AtRisk`, `TeamTable` components
take props for their data. Plumb `data.kpis`, `data.trend`, etc. through.

- [ ] **Step 1**: Read `Dashboard` and identify its mock data.
- [ ] **Step 2**: Wire `useOverview(range)`.
- [ ] **Step 3**: `npm run build`; commit:

```bash
git add src/hr/App.jsx
git commit -m "feat(hr): wire dashboard overview to use-overview"
```

### Task 5.2: Wire Teams view

**Files:**
- Modify: `src/hr/views/teams.jsx`
- Modify: `src/hr/views/teams-drawer.jsx`

Replace mock team rows with `useTeams()`. The drawer (`TeamDrawer`)
fetches drilldown via `drilldown(teamId, range)` when opened.

```jsx
import { useTeams } from '../hooks/use-teams.js';

export function HRTeamsPage({ theme, S, lang, density, chartStyle, onOpenTeam }) {
  const { teams, loading } = useTeams();
  if (loading) return <TeamsLoading theme={theme}/>;
  // render teams; clicking a row calls onOpenTeam(team)
}
```

In `TeamDrawer`:

```jsx
import { useTeams } from '../hooks/use-teams.js';
const { drilldown } = useTeams();
const [drill, setDrill] = useState(null);
useEffect(() => {
  if (!team) return;
  drilldown(team.team_id, '30d').then(setDrill);
}, [team, drilldown]);
```

- [ ] **Step 1-3**: implement, build, commit:

```bash
git add src/hr/views/teams.jsx src/hr/views/teams-drawer.jsx
git commit -m "feat(hr): wire teams view + drawer to use-teams"
```

### Task 5.3: Wire People view

**File:** `src/hr/views/people.jsx`

```jsx
import { usePeople } from '../hooks/use-people.js';

export function HRPeoplePage({ theme, S, lang, density }) {
  const { people, loading } = usePeople();
  if (loading) return <PeopleLoading theme={theme}/>;
  // render people; only display name + team — never check-in fields
}
```

Manually verify in DevTools network tab during testing that no
`/checkins` queries fire from this view.

- [ ] Build + commit:

```bash
git add src/hr/views/people.jsx
git commit -m "feat(hr): wire people roster to use-people"
```

### Task 5.4: Wire Safety view

**File:** `src/hr/views/safety.jsx`

```jsx
import { useSafety } from '../hooks/use-safety.js';

export function HRSafetyPage({ theme, S, lang, density }) {
  const { highRisk, loading } = useSafety();
  if (loading) return <SafetyLoading theme={theme}/>;
  // render highRisk teams; teams with !has_signal show a placeholder
}
```

- [ ] Build + commit:

```bash
git add src/hr/views/safety.jsx
git commit -m "feat(hr): wire safety view to use-safety"
```

### Task 5.5: Wire Content view

**File:** `src/hr/views/content.jsx`

```jsx
import { useContent } from '../hooks/use-content.js';

export function HRContentPage({ theme, S, lang, density }) {
  const { items, loading, assign } = useContent();
  if (loading) return <ContentLoading theme={theme}/>;
  // render items; "Assign" button calls await assign(item.id, scope, teamId)
}
```

- [ ] Build + commit:

```bash
git add src/hr/views/content.jsx
git commit -m "feat(hr): wire content view to use-content"
```

### Task 5.6: Wire Challenges view

**File:** `src/hr/views/challenges.jsx`

```jsx
import { useChallenges } from '../hooks/use-challenges.js';

export function HRChallengesPage({ theme, S, lang, density }) {
  const { templates, loading, schedule } = useChallenges();
  if (loading) return <ChallengesLoading theme={theme}/>;
  // render templates; "Schedule" form collects window + scope and calls schedule(template, window, scope, teamId)
}
```

- [ ] Build + commit:

```bash
git add src/hr/views/challenges.jsx
git commit -m "feat(hr): wire challenges view to use-challenges"
```

### Task 5.7: Wire Broadcasts view

**File:** `src/hr/views/broadcasts.jsx`

```jsx
import { useBroadcasts } from '../hooks/use-broadcasts.js';

export function HRBroadcastsPage({ theme, S, lang, density }) {
  const { list, loading, schedule, cancel } = useBroadcasts();
  if (loading) return <BroadcastsLoading theme={theme}/>;
  // render list grouped by status; "Schedule" form calls schedule(payload); cancel button calls cancel(id)
}
```

- [ ] Build + commit:

```bash
git add src/hr/views/broadcasts.jsx
git commit -m "feat(hr): wire broadcasts view to use-broadcasts"
```

### Task 5.8: Wire Reports view

**File:** `src/hr/views/reports.jsx`

```jsx
import { useReports } from '../hooks/use-reports.js';

export function HRReportsPage({ theme, S, lang, density }) {
  const { exportReport, busy, error, lastUrl } = useReports();
  // form: kind dropdown (overview/teams), range dropdown (7d/30d/90d), Export button
  // on click: const r = await exportReport(kind, range); window.open(r.url, '_blank');
}
```

- [ ] Build + commit:

```bash
git add src/hr/views/reports.jsx
git commit -m "feat(hr): wire reports view to use-reports"
```

### Task 5.9: Wire Settings view

**File:** `src/hr/views/settings.jsx`

```jsx
import { useSettings } from '../hooks/use-settings.js';

export function HRSettingsPage({ theme, S, lang, density }) {
  const { company, loading, update } = useSettings();
  if (loading || !company) return <SettingsLoading theme={theme}/>;
  // render form; on submit: await update({ name, settings })
}
```

- [ ] Build + commit:

```bash
git add src/hr/views/settings.jsx
git commit -m "feat(hr): wire settings view to use-settings"
```

---

## Phase 6 — Final verification

### Task 6.1: Run the full HR verification suite

End-to-end manual run-through against the cloud project, all from
`http://localhost:5173/hr.html`:

- [ ] **Step 1: Production build clean**

```bash
npm run build
```

Expected: `main`/`hr`/`admin` chunks all emit; no transform errors.

- [ ] **Step 2: All hook tests pass**

```bash
npm test
```

Expected: all Employee + HR hook tests pass. Total = 14 (employee) + 9
(HR) = 23+ tests.

- [ ] **Step 3: Walk the 12 spec verification steps**

Execute steps 1–12 from
[the spec verification section](../specs/2026-04-30-hr-portal-design.md#verification):

1. **Access:** Sign in as `hr_admin` for `Wellhouse Group` → land on
   Overview. Sign in as a regular employee → "no access" screen.
2. **Overview:** KPIs and headline trend render.
3. **Teams:** Table shows seeded teams; clicking opens the drawer. A
   team with <5 respondents shows the suppression placeholder.
4. **People:** Roster lists employees with name + team only. Network
   tab confirms no `checkins` rows fetched.
5. **Content:** Library lists; "assign" creates a row.
6. **Challenges:** Schedule a challenge; appears active.
7. **Broadcasts:** Schedule → queue. Cancel → cancelled.
8. **Reports:** Request export → CSV downloads via signed URL.
9. **Settings:** Edit company name → reload → persisted.
10. **i18n:** AR flips RTL.
11. **RLS check:** With one company's HR JWT, query another company's
    `hr_weekly_aggregates` → empty.
12. **Build health:** clean build, no console errors during run-through.

- [ ] **Step 4: RLS smoke via dashboard SQL**

```sql
-- Run as the OTHER company's HR JWT (toggle "Run as a specific user"):
SELECT count(*) FROM hr_weekly_aggregates;
-- Expected: only that user's company rows.
```

### Task 6.2: Capture follow-ups

**Files:**
- Create: `docs/superpowers/follow-ups/2026-04-30-hr-portal-followups.md`

- [ ] **Step 1: Note anything found during verification** that wasn't
  worth fixing inline. Likely items:
  - The cron header gap (Task 0.5) — service-role-key vs cron_secret
  - Broadcast send pipeline (out of scope — only schedule/cancel works)
  - Whether `content_assignments` table exists (the spec assumes it
    does; if not, add a migration)
  - Privacy floor confirmation results (Task 0.1)

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/follow-ups/
git commit -m "docs: capture HR portal follow-ups"
```

---

## Self-review

**1. Spec coverage:**
- Goal 1 (working HR portal scoped to one company) — Phases 0 + 5.
- Goal 2 (per-section module tree) — Phase 1.
- Goal 3 (RLS only) — Tasks 0.1, 6.1 step 4.
- Goal 4 (aggregates only, 5-respondent floor) — Task 0.2 view, Task
  4.4 hook excludes teams without signal, Task 6.1 step 3 verifies.
- Goal 5 (bilingual) — preserved through verbatim extraction.
- Goal 6 (visual parity) — Task 1.7 step 3 dev smoke.
- Backend additions: `hr_team_overview` (0.2), `hr_company_overview`
  (0.2), `hr_team_drilldown` (0.2), `hr-schedule-broadcast` (0.3),
  `hr-export-report` (0.4), daily cron for `compute-hr-aggregates`
  (0.5), seed `hr_admin` (0.6).
- Verification 1–12 — Task 6.1 step 3.
- Risks → privacy floor leak: Task 0.2 view enforces, Task 4.4 hook
  filters, Task 6.1 step 3 includes a small-team test.
- Risks → cross-company leak via RPC: Task 0.2 RPCs both check
  `company_id` from JWT; the team RPC additionally checks the team
  belongs to the caller.
- Risks → role bootstrap: Task 0.6 documents the SQL.

**2. Placeholder scan:** No "TBD"/"TODO" outside the spec's open
questions. Phase 5 view tasks reference component identifiers
(`KpiStrip`, `TrendsCard`, etc.) that come from `src/hr/sections.jsx`
introduced in Task 1.4 — naming consistent.

**3. Type/name consistency:**
- HR helpers (`getCompanyOverview`, `getTeamAggregates`,
  `getTeamDrilldown`, `getRoster`, `getContentLibrary`, `assignContent`,
  `listChallengeTemplates`, `scheduleChallenge`, `getChallengeStatus`,
  `listBroadcasts`, `scheduleBroadcast`, `cancelBroadcast`,
  `requestReportExport`, `getCompanySettings`, `updateCompanySettings`)
  match between Phase 2 file and Phase 4 test imports.
- Hook names (`useOverview`, `useTeams`, `usePeople`, `useSafety`,
  `useContent`, `useChallenges`, `useBroadcasts`, `useReports`,
  `useSettings`) match between Phase 4 implementations and Phase 5
  view consumers.
- `HRAuthProvider` / `useHRAuth` / `HRAppConfigProvider` /
  `useHRAppConfig` consistent across Phase 3 + App.jsx.

No issues found.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-30-hr-portal-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
