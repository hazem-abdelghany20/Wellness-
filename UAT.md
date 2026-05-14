# Wellness+ v2 — UAT Script

**Build under test:** branch `main` at HEAD · 3 SPAs · 20 migrations · 9 edge functions
**Tester time budget:** ~75 minutes for full pass · ~25 minutes for smoke pass (marked 🔥)
**Last updated:** 2026-05-14

---

## How to read this

Every test is shaped as **Precondition → Action → Expected → [ ] Result**.
Mark **PASS / FAIL / N/A** in the checkbox column. For FAILs, note severity:
**P0** ship-blocker · **P1** must fix before pilot · **P2** post-pilot polish.

---

## 0. Pre-flight (5 min)

Run these once before the UAT. If any fail, stop — the env is broken.

| # | Step | Expected | [ ] |
|---|------|----------|-----|
| 0.1 | `npm test` | 84/84 pass, 34 files | [ ] |
| 0.2 | `npm run build` | Clean build, no errors, dist/ regenerated | [ ] |
| 0.3 | `npm run dev` | Vite serves on `http://localhost:5173/` | [ ] |
| 0.4 | Open `http://localhost:5173/` | Onboarding screen renders with brand wordmark + WH-4782 pre-filled | [ ] |
| 0.5 | Open `http://localhost:5173/hr.html` | HR Portal sign-in card visible | [ ] |
| 0.6 | Open `http://localhost:5173/admin.html` | Admin Console sign-in card visible | [ ] |
| 0.7 | DevTools console, all three SPAs | No red errors (React DevTools info is fine) | [ ] |
| 0.8 | Supabase project `ewfqkhfoodijhxaqiome` reachable | `supabase status` or dashboard loads | [ ] |
| 0.9 | Seed applied (`supabase db reset` against local, OR seed run against linked) | Profiles for Amira/Yusuf/Lina/Omar/Nadia/Sara exist; awarded_rewards has 5 rows | [ ] |

**Demo credentials (Wellhouse Group, code `WH-4782`):**

| Email | Role | Demo state |
|---|---|---|
| `amira.hassan@demo.wellhouse.test` | employee | 12-day streak · 3 awarded rewards (ready / claimed / fulfilled) |
| `yusuf.naguib@demo.wellhouse.test` | employee | 5-day streak |
| `lina.farouk@demo.wellhouse.test` | employee | 1 ready reward |
| `omar.sami@demo.wellhouse.test` | employee | 3-day streak (fresh user) |
| `nadia.kamel@demo.wellhouse.test` | manager | 21-day streak · 1 claimed reward |
| `sara.hr@demo.wellhouse.test` | HR admin | HR portal access |

> OTP auth: in the Supabase dashboard → Authentication → set "Allow new sign-ups" off if hardening; for UAT, magic-link delivery to these `@demo.wellhouse.test` addresses won't work — log in as each user via Supabase dashboard "Send magic link" → copy the token → paste into the UI.

---

## A. Employee app — golden paths (15 min) 🔥

### A1. Onboarding 🔥

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| A1.1 | Land on `/` while signed out | Onboarding screen, gold wordmark, WH-4782 in field, "Continue" CTA visible | [ ] |
| A1.2 | Enter `bad-code` + valid email → Continue | Inline error, no email sent | [ ] |
| A1.3 | Enter `WH-4782` + `amira.hassan@demo.wellhouse.test` → Continue | OTP sent / step transitions to code entry | [ ] |
| A1.4 | Enter 6-digit OTP → Continue | Sign-in success, lands on Home (or onboarding baseline if first time) | [ ] |
| A1.5 | First-run only — baseline check-in (sleep/stress/energy/mood/goals) | Persists; subsequent loads skip this | [ ] |

### A2. Home / Today screen 🔥

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| A2.1 | Land on Home as Amira | Tier badge on streak card (gold/silver/bronze per tier lib); streak count = 12 | [ ] |
| A2.2 | Progress-to-next-tier bar visible under streak | Bar fills proportionally; label "X days to silver" (or next) | [ ] |
| A2.3 | Toggle Tweaks → Ramadan Mode ON | Suhoor + Iftar time strip appears with Cairo times | [ ] |
| A2.4 | Header bell icon | aria-label present; tap opens Notifications | [ ] |
| A2.5 | Header avatar icon | aria-label present; tap opens Profile | [ ] |

### A3. Check-in 🔥

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| A3.1 | Tap Check-in tab | 4 sliders (sleep / stress / energy / mood) render with current scale | [ ] |
| A3.2 | Submit values | Persists; streak_current increments; Home shows confetti or affirming state | [ ] |
| A3.3 | Submit second time same day | Upserts (no duplicate); no error | [ ] |
| A3.4 | Optional note field | Saves and reappears on Progress detail | [ ] |

### A4. Mine / Wallet 🔥

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| A4.1 | Tap Mine tab as Amira | 3 reward rows visible: 1 Ready, 1 Claimed, 1 Fulfilled | [ ] |
| A4.2 | Status dots use the right colors (Ready=accent, Claimed=amber, Fulfilled=muted) | Visually distinct | [ ] |
| A4.3 | Tap the Ready reward (gold tier) | Choose-from-options sheet opens with Sakoon / Sleep Reset / Empath | [ ] |
| A4.4 | Pick an option → Claim | RPC `claim_my_reward` succeeds; row updates to Claimed; sheet closes | [ ] |
| A4.5 | Tap a Claimed row | No action (or info-only); does not re-trigger claim | [ ] |
| A4.6 | Switch user to Omar (no rewards) → Mine tab | Empty state copy: "Nothing here yet — keep showing up" | [ ] |
| A4.7 | Force a network error mid-claim (DevTools offline) | ErrorState renders; existing rows still visible | [ ] |

### A5. Signature competitions (Sabr 21d / Niyyah 7d)

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| A5.1 | Challenges tab → Sabr card → enter path | Header reads "صبر" / "Sabr"; Arabic large-display typography when locale=ar | [ ] |
| A5.2 | Day cards 1..21 visible | Day 1 (or active day) highlighted; future days disabled | [ ] |
| A5.3 | Open active day → write reflection → Complete | `practice_completions` insert; card flips to done state with check | [ ] |
| A5.4 | All 21 days complete | CompletionCard renders | [ ] |
| A5.5 | Same flow on Niyyah path | 7 days; warm-earth accent; intention-setting prompts | [ ] |

### A6. Content library

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| A6.1 | Library tab | Featured rail + categorized list (sleep / stress / mindfulness) | [ ] |
| A6.2 | Open "Sleep onset" audio | Player screen opens with progress | [ ] |
| A6.3 | Pause + reopen later | Resumes from same `progress_s` | [ ] |

### A7. Notifications

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| A7.1 | Bell badge | Shows unread count (realtime) | [ ] |
| A7.2 | Open Notifications | List, most recent first; tap marks read | [ ] |
| A7.3 | "Mark all read" | Badge clears | [ ] |

### A8. Profile

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| A8.1 | Profile screen | Display name, streak, total check-ins, avatar | [ ] |
| A8.2 | Toggle "Privacy" and "Notifications" prefs | Persists across reload | [ ] |
| A8.3 | "Delete my account" | Confirmation step; on confirm, edge fn `delete-account` runs; user signed out | [ ] |

---

## B. HR portal (20 min) 🔥

Sign in as `sara.hr@demo.wellhouse.test`.

### B1. Overview 🔥

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| B1.1 | Land on Overview | KPI tiles for company (mood / stress / streak / participation) | [ ] |
| B1.2 | Weekly trend chart | Shows 4-week sparkline | [ ] |
| B1.3 | Sub-5 group | Any team with <5 active users shows a "Group too small to display" suppressed state — NEVER raw numbers | [ ] |

### B2. People & Teams

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| B2.1 | People list | 6 demo profiles in Wellhouse | [ ] |
| B2.2 | Filter by team (Engineering) | 2 profiles (Amira, Yusuf) | [ ] |
| B2.3 | Search "lina" | Lina Farouk row only | [ ] |

### B3. Gifts — Overview 🔥

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| B3.1 | Gifts → Overview | 4 stat cards (Total budget · Remaining · Rewards awarded · Pending fulfillment) | [ ] |
| B3.2 | Stats numbers reflect seed | 500,000 EGP budget · 5 awarded · 2 pending fulfillment | [ ] |
| B3.3 | 3 quick action cards | "New gift pool" / "Edit catalog" / "Configure tier rewards" navigate correctly | [ ] |
| B3.4 | Activity feed | 5 rows; each shows employee initials, tier badge, status, time-ago | [ ] |
| B3.5 | Click "Mark fulfilled" on Nadia's claimed Sakoon row | Row status → Fulfilled; stats counters refresh | [ ] |

### B4. Gifts — Catalog 🔥

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| B4.1 | Gifts → Catalog → WH Services tab | 6 items (Sakoon · Sleep Reset · Stress Less · Empath · Catalyst · Wellbeing Index) | [ ] |
| B4.2 | Add a new WH Service item | Persists; visible after refresh | [ ] |
| B4.3 | Toggle item active=false | Disappears from tier picker | [ ] |
| B4.4 | Amazon tab | Stub state with "Coming with Tremendous integration" copy | [ ] |
| B4.5 | Custom tab | Stub state | [ ] |

### B5. Gifts — Tier rewards 🔥

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| B5.1 | Tier rewards → Sleep Sprint | Bronze / Silver / Gold rows | [ ] |
| B5.2 | Bronze row | Fixed item = "Wellbeing Index — quarterly review", `allow_choice=false` | [ ] |
| B5.3 | Silver row | `allow_choice=true`, 2 options (Stress Less + Catalyst) | [ ] |
| B5.4 | Gold row | `allow_choice=true`, 3 options (Sakoon + Sleep Reset + Empath) | [ ] |
| B5.5 | Toggle Bronze to allow_choice=true → pick 2 options → save | Persists; appears in employee choose sheet | [ ] |
| B5.6 | Pools tab | Marked "soon" — intentional stub | [ ] |

### B6. Challenges

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| B6.1 | Challenges list | Active "21-Day Sleep Sprint" + signature comps (Sabr, Niyyah if seeded) | [ ] |
| B6.2 | Create a new challenge | Form validates; saves | [ ] |

### B7. Content

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| B7.1 | Content list | 6 seeded items, EN + AR titles | [ ] |
| B7.2 | Toggle published flag | Item hidden in employee Library | [ ] |

### B8. Broadcasts

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| B8.1 | New broadcast → preview card | Shows gold mark + "WELLNESS+ · From your HR team" header | [ ] |
| B8.2 | Schedule + send | Notification appears for at least one demo user (check Amira's notifications) | [ ] |

### B9. Reports & Safety

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| B9.1 | Reports → download CSV | File contains weekly aggregates (DP-noised values) | [ ] |
| B9.2 | Safety queue | Any flagged check-ins surface here; HR can resolve | [ ] |

### B10. Settings

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| B10.1 | Settings → company info | Edits persist | [ ] |
| B10.2 | Locale toggle EN ↔ AR | All HR copy flips; RTL layout applied | [ ] |

---

## C. Admin console (15 min)

Sign in as a platform admin (separate creds; not in demo seed — confirm with Hazem).

### C1. Platform overview

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| C1.1 | Overview | Tenants count / total seats / MRR | [ ] |
| C1.2 | Tenants list | Wellhouse Group + Nile Group rows | [ ] |

### C2. Tenant detail

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| C2.1 | Open Wellhouse row | Billing state + plan visible | [ ] |
| C2.2 | Suspend tenant → reactivate | State transitions correctly | [ ] |

### C3. Other admin views (smoke only)

| # | Section | Expected | [ ] |
|---|---------|----------|-----|
| C3.1 | Billing | Per-tenant MRR + seats | [ ] |
| C3.2 | Roles | Role list + edit | [ ] |
| C3.3 | Audit log | Recent events visible | [ ] |
| C3.4 | Integrations | List with status | [ ] |
| C3.5 | Feature flags | Toggle + scope | [ ] |
| C3.6 | Localization | EN/AR strings editable | [ ] |
| C3.7 | Challenge templates | List + create | [ ] |
| C3.8 | Global content | List + create | [ ] |

---

## D. Cross-cutting (15 min) 🔥

### D1. i18n + RTL 🔥

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| D1.1 | Employee app — toggle locale to AR | All visible copy in Arabic | [ ] |
| D1.2 | Layout in AR | `dir=rtl` applied; icons + chevrons mirror; sliders read right-to-left | [ ] |
| D1.3 | HR portal — same | Arabic + RTL throughout | [ ] |
| D1.4 | Sabr screen in AR | Large display Arabic typography (Instrument Serif / IBM Plex Sans Arabic) | [ ] |
| D1.5 | Numbers + dates | Eastern Arabic numerals where used; otherwise Western with `tnum` font feature | [ ] |

### D2. PWA shell 🔥

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| D2.1 | Chrome DevTools → Application → Manifest | Loads with no warnings; 4 icons listed (any + maskable, 192 + 512) | [ ] |
| D2.2 | Lighthouse PWA audit (Chrome → Lighthouse → PWA) on prod build | Installable; no failing icon checks | [ ] |
| D2.3 | Install banner | Appears in prod build only (Chrome with PWA install criteria met) | [ ] |
| D2.4 | "Install" CTA | OS install prompt opens | [ ] |
| D2.5 | Service worker registered | `wellness-v2` in Application → Service Workers | [ ] |
| D2.6 | Apple touch icon | `apple-touch-icon.png` resolves at `/apple-touch-icon.png` (180×180) | [ ] |

### D3. Offline behaviour 🔥

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| D3.1 | Load app online → DevTools offline mode → reload | Branded `/offline.html` renders ("You're offline" with retry button) | [ ] |
| D3.2 | While in-app, toggle DevTools offline | OfflineBanner appears below status bar with amber dot | [ ] |
| D3.3 | Reconnect | Banner disappears within 1s | [ ] |
| D3.4 | Submit check-in while offline | Either queues or surfaces an error toast — no silent data loss | [ ] |
| D3.5 | Hashed bundle assets cached | After first load, JS/CSS load from SW cache (Network tab shows "(ServiceWorker)") | [ ] |

### D4. Accessibility 🔥

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| D4.1 | Tab through onboarding | Logical focus order; visible focus ring | [ ] |
| D4.2 | Screen reader (VoiceOver / NVDA) on Home | Bell + avatar icon buttons announce their aria-label | [ ] |
| D4.3 | Screen reader on OfflineBanner | "Status: You're offline · Changes will sync…" announced via `role=status` + `aria-live` | [ ] |
| D4.4 | Color contrast on key buttons (Continue CTA, Tier badge) | Passes WCAG AA via axe DevTools | [ ] |
| D4.5 | Touch target sizes | ≥ 44×44 on primary actions | [ ] |

### D5. Realtime

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| D5.1 | HR awards a reward to Amira in one window | Amira's Mine tab in another window updates without manual refresh | [ ] |
| D5.2 | Notification sent to Amira | Bell badge increments live | [ ] |
| D5.3 | Challenge leaderboard update | Position changes propagate | [ ] |

---

## E. Privacy & data integrity (10 min) — **GO/NO-GO for Foundever pilot**

### E1. Sub-5 floor (CRITICAL)

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| E1.1 | Set up a team with 4 active check-ins this week | HR overview shows team as "Group too small to display" or omitted from per-team list | [ ] |
| E1.2 | Try to insert a row into `hr_weekly_aggregates` with `group_size=4` via SQL | CHECK constraint rejects | [ ] |
| E1.3 | Run `compute_hr_aggregate(...)` for a sub-5 group | Function early-returns; no row written | [ ] |
| E1.4 | Add a 5th distinct check-in to that team → re-run | Row appears with `group_size >= 5` | [ ] |

### E2. ε=2 differential privacy

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| E2.1 | Run `compute_hr_aggregate` twice for the same (company, team, week) | `avg_sleep`, `avg_mood`, etc. differ between runs (Laplace noise) | [ ] |
| E2.2 | Noise magnitude on metrics | Typical |Δ| ≤ 1.0 on 1–10 scale for n≥5 (sensitivity 9/n × 2/ε) | [ ] |
| E2.3 | `p25_sleep` and `p75_sleep` also vary across runs | YES — confirms percentile DP migration `0021` applied | [ ] |
| E2.4 | `p25_sleep <= p75_sleep` always | YES — monotone re-order works | [ ] |
| E2.5 | All values clipped to [1,10] | YES | [ ] |
| E2.6 | `checkin_rate` ∈ [0,1] | YES | [ ] |

### E3. RLS

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| E3.1 | Sign in as Amira (employee, Wellhouse) | Cannot read another company's profiles, content, or aggregates | [ ] |
| E3.2 | Sign in as Sara (HR, Wellhouse) | Reads Wellhouse profiles only; NOT Nile Group | [ ] |
| E3.3 | Try to read another employee's `awarded_rewards` | RLS blocks; returns 0 rows | [ ] |
| E3.4 | Try to write `tier_configurations` as employee | RLS blocks; 403 | [ ] |

### E4. Multi-tenancy

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| E4.1 | Sign up new user with `NG-9130` company code | Lands in Nile Group; cannot see Wellhouse data | [ ] |
| E4.2 | Global content (`company_id IS NULL`) | Visible to both tenants | [ ] |
| E4.3 | Per-company tier configuration override | Wellhouse silver options ≠ Nile silver options | [ ] |

---

## F. Edge cases (10 min)

### F1. Empty states

| # | Screen | Expected | [ ] |
|---|--------|----------|-----|
| F1.1 | New employee, no check-ins | Home shows encouraging zero-state, not blank space | [ ] |
| F1.2 | Mine tab with 0 rewards | EmptyState copy renders | [ ] |
| F1.3 | HR Gifts activity feed with 0 rows | "No rewards have been awarded yet…" message | [ ] |
| F1.4 | Content library with 0 items | Polite empty state, not blank | [ ] |

### F2. Error states

| # | Trigger | Expected | [ ] |
|---|---------|----------|-----|
| F2.1 | Block Supabase URL in DevTools → reload Mine tab | ErrorState renders (not white screen) | [ ] |
| F2.2 | Force a 500 on `claim_my_reward` | Toast / inline error; reward stays in Ready state | [ ] |
| F2.3 | Submit check-in with all 0s | Validation error or rejected gracefully | [ ] |

### F3. Loading states

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| F3.1 | Cold load Mine tab on slow network (DevTools Slow 3G) | Skeleton / shimmer state appears before data | [ ] |
| F3.2 | Loading state respects RTL | No layout shift when locale=ar | [ ] |

### F4. Env / boot

| # | Action | Expected | [ ] |
|---|--------|----------|-----|
| F4.1 | Build with both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` unset → run prod build | App throws immediately with the env-var names — does NOT silently fall back | [ ] |
| F4.2 | Dev mode without env vars | App boots, console.warns, UI shell inspectable | [ ] |

---

## G. Final go / no-go (5 min)

| Question | Answer | Note |
|---|---|---|
| Did any **P0** fail? | ☐ Yes ☐ No | If yes — DO NOT ship |
| Did any **E.\*** (privacy) fail? | ☐ Yes ☐ No | Hard pilot blocker |
| Are all 🔥 smoke tests green? | ☐ Yes ☐ No | Required for any release |
| Lighthouse PWA score ≥ 90? | ☐ Yes ☐ No | Sprint 4 target |
| Has confirmed WH Services SKUs + tier defaults? | ☐ Yes ☐ No | Catalog still has placeholder copy if no |
| Foundever pilot date locked? | ☐ Yes ☐ No | Anchors any compression decisions |

**Tester sign-off:** _____________________  **Date:** _____________________

---

## Appendix — known-stubbed-by-design (not failures)

- HR Gifts → Pools tab labeled "soon"
- HR Gifts → Catalog Amazon + Custom tabs — visual stubs (Tremendous integration deferred)
- Capacitor / native wrap — v1.5+
- Adam Design Mode 6 visual polish pass — deferred
