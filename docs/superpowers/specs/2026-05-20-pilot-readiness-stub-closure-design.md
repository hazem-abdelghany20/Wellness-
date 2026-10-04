# Pilot-Readiness Stub Closure — Design

**Date:** 2026-05-20
**Status:** Implemented 2026-05-20 (see the plan for commit SHAs)
**Scope:** Close the 5 user-visible gaps between `CLIENT_TEST_FLOW.md` and the deployed Wellness+ build at `https://main.d1c79md4n000h6.amplifyapp.com/`, plus one copy fix and one doc update.
**Out of scope:** Admin tenant suspend, HR Settings sub-tabs marked `soon`, Gifts Pools/Amazon/Custom, free-form challenge editor, native iOS/Android wrap.

---

## Background

A full client-flow audit (in-browser, local + production) surfaced 8 P1 mismatches between the test-flow doc and the shipped code. The user's target is **Foundever-pilot-ready**, defined as: close every gap that would hurt a paid pilot, leave intentional v1.5 stubs alone.

Cut decisions made during brainstorming:

- **Free-form HR challenge editor:** out of scope. Template-schedule is enough for the pilot; rename the misleading "+ New challenge" button to "Schedule challenge."
- **Admin tenant suspend/reactivate:** out of scope. Pilot HR doesn't touch the admin console.
- **HR Settings sub-tabs labeled `soon`:** out of scope. Already-communicated stubs.
- **Doc-only items (OTP, demo password, AR support):** already addressed in the latest `CLIENT_TEST_FLOW.md` rewrite.

## Goals

1. After this work lands, a pilot user following `CLIENT_TEST_FLOW.md` end-to-end should encounter no ⚠️ surprises among the 5 fixes below.
2. Each fix lands as its own atomic commit so individual rollback is trivial.
3. No DB migrations, no schema changes — the tables and edge functions all already exist.
4. Build stays green (`npm run build` exits 0). Existing 7 stale-test failures stay (orthogonal; documented in earlier audit).

## Non-goals

- Fixing the 7 stale unit tests. They describe APIs that don't exist (`signInWithOtp`/`verifyOtp`) or expect pre-bilingual-sweep string shapes. The production code is correct; the tests should be rewritten separately.
- Refactoring or expanding any of the stubbed `soon` tabs.
- Touching the admin console.
- Adding the deleted-account audit trail (the existing `delete-account` edge fn is the contract).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ Wave 0 — Setup commit (sequential, ~5 min)                            │
│   Add 3 new exports to src/lib/supabase.ts:                           │
│     • deleteMyAccount()                                               │
│     • getContentProgress(itemId)                                      │
│     • subscribeToAwardedRewards(profileId, cb)                        │
│   Verify build is green before fanning out.                           │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Wave 1 — 5 fixer subagents dispatched in parallel                     │
│                                                                       │
│   Agent A: Employee Profile     → profile.jsx                         │
│   Agent B: Content player resume → content.jsx + use-content.js      │
│   Agent C: Wallet realtime       → use-wallet.js                     │
│   Agent D: HR People team filter → people.jsx                        │
│   Agent E: HR Settings locale    → settings.jsx + app-config-context │
│                                                                       │
│   Each agent: read file → edit → commit atomically.                   │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Wave 2 — Synthesis (sequential, ~15 min)                              │
│   1. Fold in the HR Challenges button rename (5-min copy fix)         │
│   2. npm test (expect same 7 stale failures — no new regressions)     │
│   3. npm run build                                                    │
│   4. Browser smoke each fix (preview_start + targeted clicks)         │
│   5. Update CLIENT_TEST_FLOW.md (remove the 5 resolved ⚠️ callouts)   │
│   6. Commit + push to main                                            │
└──────────────────────────────────────────────────────────────────────┘
```

### Why this shape

- **File isolation between agents.** Each fixer owns disjoint files. The one shared module (`supabase.ts`) is mutated only in Wave 0, then read-only thereafter.
- **Atomic commits per agent.** Five independent commits (six with the copy fix). If one breaks, `git revert <sha>` is enough; no need to unwind a giant change.
- **Single synthesis pass.** Build + test + browser smoke + doc update happen once, after all agents complete. Catches cross-fix interference.

---

## Per-fix design

### Fix 1 — Delete-account button on Profile

**File:** `src/employee/screens/profile.jsx` (+ helper in `src/lib/supabase.ts`)

**What ships:**
- New section at the bottom of profile.jsx under existing toggles, before/after Sign out, titled "Delete account" (AR: "حذف الحساب").
- Two-step gate:
  1. Tap "Delete my account" → inline confirm panel slides in with destructive copy ("This permanently deletes your data — this cannot be undone").
  2. "Yes, delete everything" button (red/destructive tone). Cancel button to the left.
- On confirm: call `deleteMyAccount()` helper, which invokes the existing `delete-account` edge function via `supabase.functions.invoke(...)`. On success: call `signOut()`. On failure: show an inline error, keep the user signed in.
- Bilingual: EN + AR copy.

**New lib helper:**
```ts
export async function deleteMyAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
  return data;
}
```

**Why two-step (not type-DELETE):** Two-step matches the platform's existing destructive-action pattern (Sign out is one-step; this raises the bar to two but doesn't introduce a new keyboard interaction).

### Fix 2 — Content player resumes from `progress_s`

**Files:** `src/employee/hooks/use-content.js`, `src/employee/screens/content.jsx`, `src/lib/supabase.ts`

**What ships:**
- `useContent` adds a `getProgress(itemId)` callback that wraps a new `getContentProgress` lib helper.
- `ScreenPlayer`'s mount effect: if the current item has a UUID-shaped ID (matching the existing throttled-write guard), call `getProgress(item.id)` and seed `pos` with the returned `progress_s`.
- If no row exists (first play) or item is a legacy slug, default to 0 (current behavior).
- No change to the write side — throttled 5s saves keep working.

**New lib helper:**
```ts
export async function getContentProgress(itemId: string): Promise<number> {
  const { data, error } = await supabase
    .from('content_progress')
    .select('progress_s')
    .eq('item_id', itemId)
    .maybeSingle();
  if (error) return 0;
  return data?.progress_s ?? 0;
}
```

(RLS already restricts to `user_id = auth.uid()`, so no extra filter needed.)

**Edge case:** completed items (`completed = true`) — should they restart at 0 or resume? Per Foundever-pilot heuristic: if a user re-opens a completed item, restart from 0 (they're listening again). Implementation: helper returns 0 when `completed = true`.

### Fix 3 — Mine tab realtime channel

**Files:** `src/employee/hooks/use-wallet.js`, `src/lib/supabase.ts`

**What ships:**
- New `subscribeToAwardedRewards(profileId, cb)` helper, mirroring `subscribeToNotifications` exactly.
- `use-wallet.js` adds a `useEffect` keyed on the current profile ID that subscribes on mount, unsubscribes on unmount, and calls `refetch()` on any `postgres_changes` event for `awarded_rewards` filtered to `profile_id = X`.
- No change to render logic — the refetch path already handles all status updates.

**New lib helper:**
```ts
export function subscribeToAwardedRewards(profileId: string, cb: (payload: unknown) => void) {
  return supabase
    .channel(`awarded_rewards:${profileId}:${channelSuffix()}`)
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'awarded_rewards', filter: `profile_id=eq.${profileId}` },
        cb)
    .subscribe();
}
```

`use-wallet.js` needs `useAuth()` from `src/employee/state/auth-context.jsx` to read `session?.user?.id`. Add the import; pass the id into the subscribe call. Guard against `null` session (subscription only fires when id is truthy).

**Refetch vs in-place merge:** Refetch. Matches `useNotifications` pattern; smaller surface area to test; trades a few hundred ms latency for code simplicity. In-place merge can come later if pilots show wallet-list scale issues.

### Fix 4 — HR People team-filter chips

**File:** `src/hr/views/people.jsx`

**What ships:**
- Derive team list from roster: `Array.from(new Set(roster.map(p => p.team).filter(Boolean)))`.
- Render filter chip row: "All" + one chip per team. Visual matches the existing "All" chip style.
- Filter predicate: `(filter === 'all' || p.team === filter) && (search === '' || nameMatches || teamMatches)`.
- Bilingual: chip labels are the team names themselves (which are already human-readable strings); no extra translation needed.

**No new lib helper.** Pure UI logic.

### Fix 5 — HR Settings locale toggle

**Files:** `src/hr/views/settings.jsx`, (read-only) `src/hr/state/app-config-context.jsx`

**What ships:**
- Inside the existing **Privacy & data** sub-tab (currently the only one not marked `soon`), add a new section titled "Language" before "Quiet hours."
- Segmented control matching the Tweaks-panel pattern: `[['en','English'],['ar','العربية']]`, bound to `useHRAppConfig().cfg.lang` / `.patch({ lang })`.
- Keep the Tweaks-panel toggle as-is (dev mode still needs it).
- Persistence: already handled by the app-config-context — no new code needed.

**Why inside Privacy & data instead of unlocking the Localization tab:** The Localization tab is for HR-content localization (strings, broadcasts) which is a larger v1.5 feature. The locale toggle here is for the HR rep's own UI language, which is a different concern. Privacy & data is the only "live" tab, so users will discover it there.

### Fix 6 — HR Challenges button rename (copy)

**File:** `src/shared/tokens.jsx` (HR_STRINGS)

**What ships:**
- Change `S.newChallenge` from `"New challenge"` to `"Schedule challenge"` (EN) and equivalent AR.
- Fold into synthesis commit (too small to justify its own commit).

---

## Risk and rollback

| Risk | Mitigation |
|---|---|
| Delete-account confirmation skipped by misclick | Two-step UI gate. Destructive button is visually distinct (red). |
| Wallet realtime subscription leaks across portals | Channel topic includes `profileId` and the RLS filter is `profile_id=eq.<X>`. Verified locally and via existing notification pattern. |
| Content resume restarts after completion | Helper returns 0 for `completed = true` rows. |
| HR team chip list bloats with departments | Cap at all unique team names from current roster (current max: 3). If real customers have 20+ teams, chip row will scroll horizontally — acceptable for pilot. |
| Setup commit breaks an existing import | Setup only **adds** exports; existing imports unaffected. |
| Two agents touch the same file | None of the 5 do. Sole shared file (`supabase.ts`) is mutated only in Wave 0. |
| Browser smoke fails on prod | Each fix is its own commit on main; reverting one doesn't undo the others. |

## Validation strategy

### Per-fix browser smoke (in synthesis pass)

| Fix | Steps |
|---|---|
| Delete | Sign in as a throwaway demo account → Profile → Delete account → confirm → expect signed-out + redirect to join screen. |
| Player resume | Play Sleep onset for 30s → leave to Library → reopen → confirm position resumes ≥ 25s. |
| Wallet realtime | Open Mine in browser; in another tab (or via SQL) award a reward to Amira; confirm row appears in Mine without refresh. |
| HR team filter | Sign in as Sara → People → click "Engineering" chip → confirm only Amira, Yusuf, Hazem visible. |
| HR Settings locale | Settings → flip Arabic → confirm UI flips RTL + reload preserves the setting. |
| HR Challenges rename | Challenges page → button reads "Schedule challenge", not "+ New challenge". |

### Automated checks (must pass)

- `npm run build` — exit 0.
- `npm test` — 85 pass / 7 fail unchanged (stale tests, orthogonal to this work).

### Cross-portal smoke (synthesis pass, optional)

- Sign in as Sara, award a reward to Amira → in Amira's tab, Mine tab updates without refresh.
- Send a broadcast from Sara → Amira's bell badge increments without refresh (already working; regression-check).

## Deliverables

| Artifact | Location |
|---|---|
| 6 atomic commits on `main` | git log |
| Updated `CLIENT_TEST_FLOW.md` | repo root |
| This spec | `docs/superpowers/specs/2026-05-20-pilot-readiness-stub-closure-design.md` |
| Implementation plan (next) | TBD by writing-plans skill |
