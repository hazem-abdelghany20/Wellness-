# Pilot-Readiness Stub Closure — Implementation Plan

> **Status: EXECUTED 2026-05-20.** All five fixes and the copy rename landed on `main`; the step checkboxes below were not ticked as the work ran. Commits: `44e10c9` (lib helpers) · `fc902d4` · `153e9b1` (profile delete-account) · `49dd2e3` (player resume) · `8a4e32d` (wallet realtime) · `edf4d53` (HR people team filter) · `47ca6c1` (HR settings language) · `6b8667f` ("Schedule challenge" rename) · `0dca836` (test-flow doc trimmed).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 5 pilot-visible gaps in the Wellness+ build, plus 1 copy fix and 1 doc update, so the Foundever pilot client can follow `CLIENT_TEST_FLOW.md` end-to-end without ⚠️ surprises.

**Architecture:** Three execution waves. Wave 0 lands a setup commit adding 3 new exports to `src/lib/supabase.ts`. Wave 1 dispatches 5 fixer subagents in parallel — each owns disjoint files. Wave 2 folds in the copy fix, runs build/test/browser smoke, updates the client doc, and pushes.

**Tech Stack:** React 18 (no JSX framework — plain Vite SPA), Supabase (auth + Postgres + Realtime + Edge Functions), vitest, Testing Library. Three SPA entry points: `main-employee.jsx`, `main-hr.jsx`, `main-admin.jsx`.

**Branch policy:** Commit directly to `main` and push after each wave (user preference, see `memory/feedback_main_branch.md`).

**Spec:** [docs/superpowers/specs/2026-05-20-pilot-readiness-stub-closure-design.md](../specs/2026-05-20-pilot-readiness-stub-closure-design.md)

---

## File Plan

**Modified (10 files):**
- `src/lib/supabase.ts` — add 3 new exports (Wave 0 only)
- `src/employee/i18n.jsx` — add delete-account strings (Task 1)
- `src/employee/screens/profile.jsx` — wire delete-account UI (Task 1)
- `src/employee/hooks/use-content.js` — expose `getProgress` (Task 2)
- `src/employee/screens/content.jsx` — read progress on mount (Task 2)
- `src/employee/hooks/use-wallet.js` — subscribe to realtime (Task 3)
- `src/hr/views/people.jsx` — team-filter chips (Task 4)
- `src/hr/views/settings.jsx` — locale toggle inside Privacy & data (Task 5)
- `src/shared/tokens.jsx` — HR_STRINGS `newChallenge` copy fix (Task 6)
- `CLIENT_TEST_FLOW.md` — remove resolved ⚠️ callouts (Task 7)

**Created (0):** no new files; all changes additive to existing modules.

---

## Task 0: Setup — add three lib helpers

**Files:**
- Modify: `src/lib/supabase.ts` (append after existing `subscribeToPlanCompletions` around line 444)

**Goal:** Land all new server-facing helpers in one commit before parallel fixer agents fan out. Setup is additive-only — no existing imports change behaviour.

- [ ] **Step 0.1: Read the current shape of supabase.ts**

Run: `wc -l src/lib/supabase.ts && grep -n "^export" src/lib/supabase.ts`
Expected: confirms current exports include `saveContentProgress`, `subscribeToNotifications`, etc.

- [ ] **Step 0.2: Append `deleteMyAccount`**

Add at the bottom of `src/lib/supabase.ts` (or anywhere after the existing `signOut` export):

```ts
// ── Account management ────────────────────────────────────────

/**
 * Invoke the `delete-account` edge function to permanently remove the
 * current user. Caller is responsible for signing out after success.
 */
export async function deleteMyAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
  return data;
}
```

- [ ] **Step 0.3: Append `getContentProgress`**

Add directly after `saveContentProgress` (around line 326):

```ts
/**
 * Read the saved play position for a content item.
 * Returns 0 when:
 *   - no row exists yet,
 *   - the row is marked completed (re-open replays from start),
 *   - any error occurs (player falls back to start).
 */
export async function getContentProgress(itemId: string): Promise<number> {
  const { data, error } = await supabase
    .from('content_progress')
    .select('progress_s, completed')
    .eq('item_id', itemId)
    .maybeSingle();
  if (error || !data) return 0;
  if (data.completed) return 0;
  return data.progress_s ?? 0;
}
```

- [ ] **Step 0.4: Append `subscribeToAwardedRewards`**

Add directly after `subscribeToNotifications` (around line 434):

```ts
/**
 * Realtime subscription on awarded_rewards for the current employee.
 * Caller invokes cb on any change; refetch is the simplest reaction.
 */
export function subscribeToAwardedRewards(profileId: string, cb: (payload: unknown) => void) {
  return supabase
    .channel(`awarded_rewards:${profileId}:${channelSuffix()}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'awarded_rewards',
      filter: `profile_id=eq.${profileId}`,
    }, cb)
    .subscribe();
}
```

- [ ] **Step 0.5: Build to confirm exports compile**

Run: `npm run build`
Expected: exit 0, no TypeScript errors. Bundle sizes change slightly (a few hundred bytes).

- [ ] **Step 0.6: Run tests (sanity)**

Run: `npm test 2>&1 | tail -5`
Expected: Same 7 stale failures as before (orthogonal). No NEW failures.

- [ ] **Step 0.7: Commit Wave 0**

```bash
git add src/lib/supabase.ts
git commit -m "$(cat <<'EOF'
feat(lib): add account-delete + content-resume + wallet-realtime helpers

Three additive exports for the pilot-readiness wave:
  - deleteMyAccount(): invokes the delete-account edge fn
  - getContentProgress(itemId): reads saved play position
  - subscribeToAwardedRewards(profileId, cb): realtime channel

No callers yet; wiring lands in the per-portal fixer commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 1: Delete-account button on Profile

**Files:**
- Modify: `src/employee/i18n.jsx` (lines ~113 EN block, ~220 AR block)
- Modify: `src/employee/screens/profile.jsx` (around the existing Sign-out block, lines 150-154)

**Goal:** Two-step destructive flow. Tapping "Delete my account" opens an inline confirm. Confirming invokes `deleteMyAccount()` then signs out. Cancel returns to normal state.

- [ ] **Step 1.1: Add i18n strings**

In `src/employee/i18n.jsx`, locate the EN block (around line 113 where `signOut: 'Sign out'` lives) and add:

```js
    deleteAccount:      'Delete my account',
    deleteConfirmTitle: 'Permanently delete your account?',
    deleteConfirmBody:  'This removes your check-ins, rewards, and notifications. This cannot be undone.',
    deleteConfirmYes:   'Yes, delete everything',
    deleteCancel:       'Cancel',
    deleteError:        'Could not delete account. Please try again.',
```

Then locate the AR block (around line 220 where `signOut: 'تسجيل الخروج'` lives) and add:

```js
    deleteAccount:      'حذف حسابي',
    deleteConfirmTitle: 'حذف حسابك نهائيًا؟',
    deleteConfirmBody:  'سيؤدي ذلك إلى حذف تسجيلاتك ومكافآتك وإشعاراتك. لا يمكن التراجع.',
    deleteConfirmYes:   'نعم، احذف كل شيء',
    deleteCancel:       'إلغاء',
    deleteError:        'تعذّر حذف الحساب. حاول مرة أخرى.',
```

- [ ] **Step 1.2: Wire delete UI in profile.jsx**

In `src/employee/screens/profile.jsx`:

(a) At the top, ensure the imports include `Card` (already imported) and add `deleteMyAccount` to the supabase import:

```jsx
import { deleteMyAccount } from '../../lib/supabase';
```

(b) Inside the `ScreenProfile` component, near the other `useState` calls (look for `signingOut`), add:

```jsx
const [confirmingDelete, setConfirmingDelete] = React.useState(false);
const [deleting, setDeleting] = React.useState(false);
const [deleteErr, setDeleteErr] = React.useState(null);
```

(c) Add a delete handler near the existing `handleSignOut`:

```jsx
const handleConfirmDelete = async () => {
  if (deleting) return;
  setDeleting(true); setDeleteErr(null);
  try {
    await deleteMyAccount();
    await signOut();
  } catch (e) {
    console.warn('[profile] deleteAccount failed', e);
    setDeleteErr(e?.message || t('deleteError'));
    setDeleting(false);
  }
};
```

(d) Replace the existing Sign-out block (around lines 150-154) with a new wrapper that adds the Delete section directly underneath:

```jsx
<div style={{ padding: '22px 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
  <Button theme={T} variant="secondary" style={{ width: '100%' }} onClick={handleSignOut} disabled={signingOut}>
    {signingOut ? (lang==='ar'?'…':'…') : t('signOut')}
  </Button>

  {!confirmingDelete && (
    <button
      onClick={() => { setDeleteErr(null); setConfirmingDelete(true); }}
      style={{
        width: '100%', padding: '12px 14px', borderRadius: 12,
        background: 'transparent', border: `1px solid ${T.border}`,
        color: T.textMuted, fontSize: 13, fontWeight: 500,
        fontFamily: 'inherit', cursor: 'pointer',
      }}>
      {t('deleteAccount')}
    </button>
  )}

  {confirmingDelete && (
    <Card theme={T} pad={16} style={{
      border: '1px solid rgba(220, 80, 80, 0.45)',
      background: 'rgba(220, 80, 80, 0.06)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{t('deleteConfirmTitle')}</div>
      <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.4 }}>{t('deleteConfirmBody')}</div>
      {deleteErr && (
        <div style={{ fontSize: 12, color: '#E26C6C' }}>{deleteErr}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={() => { setConfirmingDelete(false); setDeleteErr(null); }}
          disabled={deleting}
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 10,
            background: 'transparent', border: `1px solid ${T.border}`,
            color: T.text, fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>
          {t('deleteCancel')}
        </button>
        <button
          onClick={handleConfirmDelete}
          disabled={deleting}
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 10,
            background: '#C04848', border: 'none',
            color: '#FFFFFF', fontSize: 13, fontWeight: 700,
            fontFamily: 'inherit', cursor: deleting ? 'wait' : 'pointer',
            opacity: deleting ? 0.7 : 1,
          }}>
          {deleting ? '…' : t('deleteConfirmYes')}
        </button>
      </div>
    </Card>
  )}
</div>
```

- [ ] **Step 1.3: Build to confirm**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 1.4: Commit**

```bash
git add src/employee/i18n.jsx src/employee/screens/profile.jsx
git commit -m "$(cat <<'EOF'
feat(employee/profile): wire delete-account with two-step confirm

Adds a destructive-tone button under Sign out that opens an inline
confirmation card. Confirming invokes the delete-account edge fn and
then signs the user out. Bilingual EN+AR.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 2: Content player resumes from saved progress

**Files:**
- Modify: `src/employee/hooks/use-content.js`
- Modify: `src/employee/screens/content.jsx` (around lines 216-264 — `ScreenPlayer`)

**Goal:** When a player opens, seed `pos` from `content_progress.progress_s` if a row exists and the item is not completed. Only fires for UUID-shaped item IDs (matches existing write-side guard).

- [ ] **Step 2.1: Expose `getProgress` from useContent**

In `src/employee/hooks/use-content.js`, replace the import line and add a `getProgress` callback:

(a) Change the import:

```js
import { getContentItems, getFeaturedContent, saveContentProgress, getContentProgress } from '../../lib/supabase';
```

(b) Add inside the `useContent` hook body, alongside `saveProgress` (right after the existing `saveProgress` declaration):

```js
const getProgress = useCallback((id) => getContentProgress(id), []);
```

(c) Update the return statement to expose it:

```js
return { items, featured, loading, error, saveProgress, getProgress, refetch };
```

- [ ] **Step 2.2: Read progress on player mount**

In `src/employee/screens/content.jsx`, locate `ScreenPlayer` (around line 216):

(a) Change the destructure on line 219 from:

```jsx
const { saveProgress } = useContent();
```

to:

```jsx
const { saveProgress, getProgress } = useContent();
```

(b) Right after the `isDbItem` line (around line 233), add a resume-on-mount effect:

```jsx
// Resume from saved progress for DB-backed items only. Legacy slug-id
// items have no content_progress row and always start at 0.
React.useEffect(() => {
  if (!isDbItem) return;
  let cancelled = false;
  getProgress(item.id).then(savedSecs => {
    if (cancelled) return;
    if (typeof savedSecs === 'number' && savedSecs > 0 && savedSecs < dur) {
      setPos(savedSecs);
      posRef.current = savedSecs;
    }
  }).catch(() => {});
  return () => { cancelled = true; };
}, [isDbItem, item.id, dur, getProgress]);
```

- [ ] **Step 2.3: Build + tests**

Run: `npm run build && npm test 2>&1 | tail -5`
Expected: build exit 0; same 7 stale failures, no NEW failures. The existing `use-content.test.js` already mocks `saveContentProgress` — verify the new export isn't required by tests; if it is, mock it: `getContentProgress: vi.fn().mockResolvedValue(0)`.

If the test breaks because the mock factory needs the new export, update `src/employee/hooks/__tests__/use-content.test.js` accordingly (purely additive mock entry).

- [ ] **Step 2.4: Commit**

```bash
git add src/employee/hooks/use-content.js src/employee/screens/content.jsx src/employee/hooks/__tests__/use-content.test.js
git commit -m "$(cat <<'EOF'
fix(employee/player): resume audio from saved progress_s on mount

Adds a useEffect in ScreenPlayer that reads content_progress for the
current item (UUID-shaped ids only) and seeds the play head. Completed
items still restart at 0 by design.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 3: Mine tab realtime subscription

**Files:**
- Modify: `src/employee/hooks/use-wallet.js`

**Goal:** When the Mine tab is mounted, subscribe to `awarded_rewards` changes scoped to the current user. Any insert/update/delete triggers `refetch()`. Mirrors `useNotifications` pattern.

- [ ] **Step 3.1: Add realtime subscription**

Replace the full contents of `src/employee/hooks/use-wallet.js` with:

```js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { listMyAwardedRewards, claimMyReward, subscribeToAwardedRewards } from '../../lib/supabase';
import { useAuth } from '../state/auth-context.jsx';

const STATUS_ORDER = { ready: 0, claimed: 1, fulfilled: 2 };

export function useWallet() {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { session } = useAuth();
  const userId = session?.user?.id || null;

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRewards(await listMyAwardedRewards()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // Live updates: HR awards a reward → row appears without manual refresh.
  useEffect(() => {
    if (!userId) return;
    const sub = subscribeToAwardedRewards(userId, () => refetch());
    return () => sub?.unsubscribe?.();
  }, [userId, refetch]);

  const grouped = useMemo(() => {
    const buckets = { ready: [], claimed: [], fulfilled: [] };
    for (const r of rewards) {
      if (buckets[r.status]) buckets[r.status].push(r);
    }
    return buckets;
  }, [rewards]);

  const sorted = useMemo(() => {
    return [...rewards].sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 99;
      const sb = STATUS_ORDER[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime();
    });
  }, [rewards]);

  const claim = useCallback(async (rewardId, chosenItemId) => {
    const updated = await claimMyReward(rewardId, chosenItemId);
    await refetch();
    return updated;
  }, [refetch]);

  return { rewards: sorted, grouped, loading, error, refetch, claim };
}
```

**Important:** the existing `subscribeToAwardedRewards` filter is keyed by `profile_id`, but `auth.users.id` is the same UUID as `profiles.id` (the profile is provisioned with id = auth user id by `handle_new_user()`). So passing `session.user.id` correctly subscribes to the user's own rewards. Confirmed via migration `0002_create_profiles.sql`.

- [ ] **Step 3.2: Build + tests**

Run: `npm run build && npm test 2>&1 | tail -5`
Expected: build exit 0; if `use-wallet` has a test, it may need `subscribeToAwardedRewards: vi.fn(() => ({ unsubscribe: vi.fn() }))` added to the mock factory. Check `src/employee/hooks/__tests__/use-wallet.test.js` (if it exists — `ls src/employee/hooks/__tests__/`).

- [ ] **Step 3.3: Commit**

```bash
git add src/employee/hooks/use-wallet.js
[ -f src/employee/hooks/__tests__/use-wallet.test.js ] && git add src/employee/hooks/__tests__/use-wallet.test.js
git commit -m "$(cat <<'EOF'
fix(employee/wallet): subscribe to awarded_rewards realtime updates

Mine tab now updates without a refresh when HR awards a reward, fulfils
one, or claims one on the user's behalf. Mirrors the notifications
subscription pattern. Unsubscribes on unmount.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 4: HR People team-filter chips

**Files:**
- Modify: `src/hr/views/people.jsx` (lines 23-58)

**Goal:** Replace the single "All" chip with a row of chips derived from the current roster. Selecting a chip narrows the list to that team.

- [ ] **Step 4.1: Derive team list + render chips**

In `src/hr/views/people.jsx`:

(a) After the `roster` declaration (around line 23), add a memoised team list:

```jsx
const teams = React.useMemo(() => {
  const set = new Set();
  for (const p of roster) {
    if (p.team) set.add(p.team);
  }
  return Array.from(set).sort();
}, [roster]);
```

(b) Update the `filtered` predicate (around line 30) to honour `filter`:

```jsx
const filtered = roster.filter(p =>
  (filter === 'all' || p.team === filter) &&
  (search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || (p.team || '').toLowerCase().includes(search.toLowerCase()))
);
```

(c) Replace the chip render block (around lines 49-58) with a dynamic row:

```jsx
<div style={{ display: 'flex', gap: 4, background: T.panelSunk, padding: 3, borderRadius: 9, border: `1px solid ${T.border}`, flexWrap: 'wrap', maxWidth: '60%' }}>
  {[['all', s('All','الكل')], ...teams.map(t => [t, t])].map(([k, l]) => (
    <button key={k} onClick={()=>setFilter(k)} style={{
      padding: '6px 12px', borderRadius: 6, border: 'none',
      background: filter===k ? T.panel : 'transparent',
      color: filter===k ? T.text : T.textMuted,
      fontSize: 12, fontWeight: 600, cursor: 'pointer',
      whiteSpace: 'nowrap',
    }}>{l}</button>
  ))}
</div>
```

- [ ] **Step 4.2: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4.3: Commit**

```bash
git add src/hr/views/people.jsx
git commit -m "$(cat <<'EOF'
fix(hr/people): add team filter chips derived from roster

The single 'All' chip is now joined by one chip per unique team in the
current roster (Engineering, Finance, People & Ops in the seed). Filter
predicate honours the selection.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 5: HR Settings locale toggle (Privacy & data panel)

**Files:**
- Modify: `src/hr/views/settings.jsx` (top of file: imports; mid-file: insert Language panel before Quiet hours)

**Goal:** Add a Language section inside the active "Privacy & data" sub-tab. Segmented control flips `cfg.lang` via the existing app-config context — persistence is already wired by the context's `localStorage` effect.

- [ ] **Step 5.1: Import the app-config hook**

In `src/hr/views/settings.jsx`, add the import at the top (alongside the existing imports):

```jsx
import { useHRAppConfig } from '../state/app-config-context.jsx';
```

- [ ] **Step 5.2: Read + patch the lang setting**

Inside `HRSettingsPage` (top of the component body, near the other hooks):

```jsx
const { cfg, patch } = useHRAppConfig();
```

- [ ] **Step 5.3: Render the Language panel**

In the settings content column (the right-hand column starting around line 128 — the `<div style={{ display: 'flex', flexDirection: 'column', gap: ... }}>` that contains Panels), insert a new Panel **directly after** the Company name Panel and before the Aggregate-only enforcement Panel:

```jsx
<Panel theme={T} density={density}>
  <div style={{ fontSize: 14, color: T.text, fontWeight: 700, marginBottom: 4 }}>
    {s('Language','اللغة')}
  </div>
  <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 12 }}>
    {s('Switch the HR portal interface between English and Arabic. Applies only to your account.',
       'بدّل واجهة بوابة الموارد البشرية بين الإنجليزية والعربية. يسري فقط على حسابك.')}
  </div>
  <div style={{ display: 'flex', gap: 8 }}>
    {[['en','English'],['ar','العربية']].map(([k, l]) => {
      const active = cfg.lang === k;
      return (
        <button key={k} onClick={() => patch({ lang: k })} style={{
          flex: 1, padding: '10px 14px', borderRadius: 9,
          background: active ? T.accent : T.panelSunk,
          color: active ? T.accentInk : T.text,
          border: `1px solid ${active ? 'transparent' : T.border}`,
          fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          cursor: 'pointer',
        }}>{l}</button>
      );
    })}
  </div>
</Panel>
```

- [ ] **Step 5.4: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5.5: Commit**

```bash
git add src/hr/views/settings.jsx
git commit -m "$(cat <<'EOF'
fix(hr/settings): add language toggle inside Privacy & data

EN/AR segmented control wired to useHRAppConfig().patch({ lang }).
Persistence is handled by the existing app-config context.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 6: HR Challenges button rename

**Files:**
- Modify: `src/shared/tokens.jsx` (lines 107 + 150 — `newChallenge` keys)

**Goal:** Rename the misleading "+ New challenge" button to "Schedule challenge" so HR users don't expect a free-form editor.

- [ ] **Step 6.1: Change EN string**

In `src/shared/tokens.jsx` line 107:

```jsx
    newChallenge: 'Schedule challenge',
```

- [ ] **Step 6.2: Change AR string**

In `src/shared/tokens.jsx` line 150:

```jsx
    newChallenge: 'جدولة تحدّي',
```

- [ ] **Step 6.3: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 6.4: Commit (held; folded into Task 7 synthesis if convenient)**

```bash
git add src/shared/tokens.jsx
git commit -m "$(cat <<'EOF'
fix(hr/challenges): rename button from 'New challenge' to 'Schedule challenge'

HR can only schedule from existing templates (template authoring is in
the admin console). Rename clarifies the action.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 7: Synthesis — verify + update client doc + push

**Files:**
- Modify: `CLIENT_TEST_FLOW.md`

**Goal:** Verify all six fixes work end-to-end on the dev preview, then trim the now-resolved ⚠️ callouts from the client-facing test doc.

- [ ] **Step 7.1: Run full test + build**

Run: `npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -3`
Expected: 85 pass / 7 fail (unchanged from baseline — orthogonal stale tests). Build exits 0.

- [ ] **Step 7.2: Start dev preview + browser smoke each fix**

Use the preview MCP tools:

```
preview_start name=wellness-dev → record serverId
preview_eval expression="window.location.href = 'http://localhost:5173/'"
```

Then for each fix, follow the matrix in the spec (`docs/superpowers/specs/2026-05-20-pilot-readiness-stub-closure-design.md` § Validation strategy). Quick reference:

| Fix | Expected outcome |
|---|---|
| Delete (Task 1) | Profile → Delete my account → confirm panel slides in → Cancel restores; do NOT actually confirm-delete the demo user. |
| Player resume (Task 2) | Open Sleep-onset audio → play to 0:20 → use Back → reopen → position is ≥ 15s. |
| Wallet realtime (Task 3) | Open Mine; in console run `(await import('/src/lib/supabase.ts')).supabase.realtime.channels.map(c=>c.topic)` — should include `realtime:awarded_rewards:<uid>:…`. |
| HR team filter (Task 4) | Sign in as Sara → People → chips show All / Engineering / Finance / People & Ops → click Engineering → 3 rows. |
| HR Settings locale (Task 5) | Settings → Language panel visible inside Privacy & data → click العربية → UI flips RTL. |
| Challenges rename (Task 6) | HR → Challenges → button reads "Schedule challenge". |

- [ ] **Step 7.3: Update `CLIENT_TEST_FLOW.md`**

Open `CLIENT_TEST_FLOW.md` and remove these ⚠️ callouts (now resolved):

1. The block after Mine step 15 (`> ⚠️ **Known gap:** new rewards awarded by HR will **not** appear in real time...`)
2. The block after Library step 20 (`> ⚠️ **Known gap:** the reopened player currently restarts at 0:00...`)
3. The block after Profile step 25 (`> ⚠️ **Known gap:** there is no "Delete my account" button yet...`)
4. The block after People step 5 (`> ⚠️ **Known gap:** the People page has search and an "All" chip, but no team-filter dropdown...`) — replace with "Filter chips for each team appear next to the search box."
5. The block after Challenges step 20 (`> ⚠️ **Known gap:** in this build you schedule from existing templates only...`) — keep this one but change the button name reference: "+ New challenge" → "Schedule challenge".
6. The block after Settings step 29 (`> ⚠️ **Known gap:** the locale toggle (EN ↔ AR) for HR is not in Settings yet...`)
7. The block after Cross-portal #5 (`> ⚠️ **Known gap:** awarded rewards do **not** propagate to the Mine tab in real time...`) — delete.

Also update the **Known stubs / gaps** section at the bottom: remove the 5 corresponding bullets (Delete account, Player resume, Mine realtime, People filter, Settings locale). Keep the rest (admin tenant suspend, HR settings sub-tabs `soon`, Gifts Pools/Amazon/Custom, native wrap).

- [ ] **Step 7.4: Final build to confirm doc-only change is harmless**

Run: `npm run build 2>&1 | tail -3`
Expected: exit 0.

- [ ] **Step 7.5: Commit + push synthesis**

```bash
git add CLIENT_TEST_FLOW.md
git commit -m "$(cat <<'EOF'
docs: trim resolved gaps from client test flow

Removes the ⚠️ callouts for delete-account, content resume, wallet
realtime, HR people filter, and HR settings locale — all wired in this
wave. Remaining stubs (admin suspend, HR sub-tabs marked 'soon',
free-form challenge editor, native wrap) stay as-is.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 7.6: Stop the preview server**

```
preview_stop serverId=<id from step 7.2>
```

---

## Self-Review

**Spec coverage check:** Each spec section maps to a task —
- Fix 1 (Delete) → Task 1 ✓
- Fix 2 (Player resume) → Task 2 ✓
- Fix 3 (Wallet realtime) → Task 3 ✓
- Fix 4 (HR team filter) → Task 4 ✓
- Fix 5 (HR locale toggle) → Task 5 ✓
- Fix 6 (Challenges rename) → Task 6 ✓
- Doc update → Task 7 ✓
- 3 lib helpers (spec §3 Architecture, Wave 0) → Task 0 ✓
- Validation matrix (spec §4 Validation strategy) → Task 7 Step 7.2 ✓

**Placeholder scan:** No TBD/TODO; every step has executable content. The one "(if a test file exists)" branch in Step 3.2 is explicit not vague — the engineer is told which file to check and what to add.

**Type / API consistency:**
- Helper names match across tasks: `deleteMyAccount`, `getContentProgress`, `subscribeToAwardedRewards` — appear in Task 0 → consumed by Tasks 1, 2, 3 verbatim.
- `useContent` return shape gains `getProgress` — both producer (Task 2 Step 2.1c) and consumer (Task 2 Step 2.2a) use the same name.
- `useHRAppConfig().patch({ lang })` — both setting (Task 5 Step 5.2) and reading (Task 5 Step 5.3 `cfg.lang`) align.
- HR_STRINGS `newChallenge` — Task 6 modifies both EN + AR copies.

No fixes needed. Plan stands.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-20-pilot-readiness-stub-closure.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration. Best for this plan since Tasks 1–5 are independent and can be parallelised after Task 0 lands.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints. Slower but easier to course-correct mid-task.

**Which approach?**
