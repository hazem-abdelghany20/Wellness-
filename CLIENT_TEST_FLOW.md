# Wellness+ — Client Test Flow

A guided walkthrough of all three portals on the live preview build. Follow each section top-to-bottom. Each step has an **Action** (what to do) and **You should see** (what good looks like). Mark anything that doesn't match.

**Live URLs**

| Portal | URL |
|---|---|
| Employee app | https://main.d1c79md4n000h6.amplifyapp.com/ |
| HR portal | https://main.d1c79md4n000h6.amplifyapp.com/hr.html |
| Admin console | https://main.d1c79md4n000h6.amplifyapp.com/admin.html |

**Approx. time:** 60 minutes for a full pass · 25 minutes for the smoke pass (steps tagged 🔥).

---

## Before you start (5 min)

1. Open all three URLs above in separate browser tabs (Chrome or Safari).
2. Keep DevTools (F12) handy on at least one tab — you'll need it for the offline test and to flip the dev-only Tweaks panel.
3. Use these demo logins. **Password for all demo users is `WellnessDemo!2026`** (entered along with email; there is no email OTP in this build).

| Portal | Email | Notes |
|---|---|---|
| Employee | `amira.hassan@demo.wellhouse.test` | 13-day streak · Silver tier · 1 Ready / 1 Pending / 1 Delivered reward |
| Employee | `omar.sami@demo.wellhouse.test` | Fresh user · no rewards |
| Employee | `nadia.kamel@demo.wellhouse.test` | Manager · 21-day streak |
| HR | `sara.hr@demo.wellhouse.test` | HR admin for Wellhouse Group |
| Admin | (provided separately) | Platform admin — restricted role; not in demo seed |

Company code for Wellhouse: **`WH-4782`** · Nile Group: **`NG-9130`**.

> ℹ️ The build uses **email + password**, not email OTP. Just enter the password directly when signing in.

---

# Portal 1 — Employee app · ~20 min

You're an employee opening Wellness+ for the first time, then returning as a regular user.

## 1. Sign-in 🔥

URL: <https://main.d1c79md4n000h6.amplifyapp.com/>

1. **Action:** Land on the site signed out.
   **See:** Gold "Wellness+" wordmark, headline "Your workplace wellbeing companion", company code pre-filled with `WH-4782`, plus WORK EMAIL and PASSWORD fields, single "Continue" button.
2. **Action:** Type a bad code (`xxxx`) + valid email + valid password → Continue.
   **See:** Inline error, no sign-in.
3. **Action:** Use `WH-4782` + `amira.hassan@demo.wellhouse.test` + `WellnessDemo!2026` → Continue.
   **See:** Signs in directly. If brand-new account: a 5-step onboarding (consent → name → baseline check-in → goals → welcome). Otherwise lands on Home.

## 2. Home / Today 🔥

4. **Action:** Look at the streak card.
   **See:** "13" streak count, a **SILVER** tier badge, and a progress bar showing "8 days to Gold".
5. **Action:** Tap the **bell icon** (top-right).
   **See:** Notifications screen opens.
6. **Action:** Tap the **avatar icon** (top-right, golden "A").
   **See:** Profile screen opens.
7. **Action:** Open the dev-only Tweaks panel by appending `?tweaks=1` to the URL → flip **Ramadan Mode ON**.
   **See:** A Suhoor + Iftar time strip with Cairo times appears under the streak card.

## 3. Daily check-in 🔥

8. **Action:** Tap the **Check-in** tab in the bottom nav.
   **See:** Four sliders — sleep, stress, energy, mood — with sensible defaults.
9. **Action:** Pick values, add an optional note, submit.
   **See:** Success state (confetti / affirming copy). Streak increments on Home.
10. **Action:** Submit a second time the same day with different values.
    **See:** Saves cleanly, no duplicate row, no error.

## 4. Wallet / Mine tab 🔥

11. **Action:** Tap the **Mine** tab.
    **See:** Three reward rows — one **Ready to claim** (gold tier), one **Pending fulfillment** (silver, Stress Less), one **Delivered** (bronze, Wellbeing Index).
12. **Action:** Tap the **Ready** (gold) reward.
    **See:** A choose-from-options sheet with three picks: Sakoon · Sleep Reset · Empath.
13. **Action:** Pick one → "Claim my reward."
    **See:** Sheet closes, row flips to **Pending fulfillment**.
14. **Action:** Tap the now-Pending row.
    **See:** Info-only state — does not re-trigger claim.
15. **Action:** Sign out → sign in as `omar.sami@…` → Mine tab.
    **See:** Empty state ("Nothing here yet — keep showing up"), not blank.
16. **Action:** With Mine open in one tab, have HR award a new reward to this user in another tab.
    **See:** The new row appears in Mine **without** a refresh.

## 5. Signature competitions

16. **Action:** Sign back in as Amira → **Challenges** tab → tap **Sabr** (صبر).
    **See:** Header reads "Sabr" / "صبر", 21 day cards visible, today's day highlighted, future days disabled.
17. **Action:** Open today's card → write a reflection → Complete.
    **See:** Card flips to a done state with a check.
18. **Action:** Back out → tap **Niyyah** (نية).
    **See:** Same flow but 7 days, warmer palette, intention-setting prompts.

## 6. Content library

19. **Action:** Tap the **Library** tab.
    **See:** Featured rail at top, categories below (All / Sleep / Stress / Move / Focus).
20. **Action:** Open "Sleep onset — a cue for tonight" → play for 10s → use the player back button → reopen.
    **See:** Player resumes from your saved position (not back at 0:00). Progress is saved every 5 seconds while playing.

## 7. Notifications

21. **Action:** Tap the bell.
    **See:** List of notifications, newest first. Tapping one marks it read.
22. **Action:** Tap "Mark all read."
    **See:** Bell badge clears.

## 8. Profile

23. **Action:** Tap the avatar → Profile.
    **See:** Display name, edit pencil, Wellhouse Group label, **Privacy** toggle (anon on leaderboards), **Notifications** toggle (daily check-in reminder), **Language** picker (English / العربية), **Theme** picker (Brand / Light), and **Sign out**.
24. **Action:** Toggle Privacy + Notifications → reload.
    **See:** Toggles persist.
25. **Action:** Flip Language to العربية.
    **See:** UI flips to Arabic, layout mirrors to RTL.
26. **Action:** Below Sign out, tap **Delete my account** → confirm with **Yes, delete everything**.
    **See:** Two-step confirm card (don't actually delete the demo user — Cancel restores the initial state). On confirm, account is purged and you're signed out.

## 9. Arabic / RTL pass 🔥

26. **Action:** With Arabic set, navigate around (Home, Mine, Challenges).
    **See:** All visible copy in Arabic. Chevrons flip, sliders read right-to-left.
27. **Action:** Open Sabr in AR.
    **See:** Large-display Arabic typography (serif + IBM Plex Sans Arabic).

## 10. Offline behaviour 🔥

28. **Action:** DevTools → Network → **Offline** → reload the page.
    **See:** Branded "You're offline" page with a retry button, not a browser error.
29. **Action:** While in-app, flip Offline on.
    **See:** Amber dot + "You're offline" banner appears under the status bar within ~1s.
30. **Action:** Flip Offline off.
    **See:** Banner disappears within ~1s.

---

# Portal 2 — HR portal · ~20 min

URL: <https://main.d1c79md4n000h6.amplifyapp.com/hr.html>

Sign in as `sara.hr@demo.wellhouse.test` with the same password `WellnessDemo!2026`.

## 1. Dashboard 🔥

1. **Action:** Land on the Dashboard.
   **See:** Four KPI tiles — **Wellbeing index 7.3/10**, **Weekly active 6**, **At-risk teams 0**, **Safety flags 0 open**.
2. **Action:** Scroll to the "Wellbeing trends" chart.
   **See:** Multi-line chart (Mood / Stress / Sleep / Energy) over the selected window (7d / 30d / 90d).
3. **Action:** Scroll to the "Team breakdown" table.
   **See:** Each team listed with metrics. Teams with **<5 active members** display dashes/blanks across metric columns and a low-risk badge — privacy floor is enforced at the DB layer.

## 2. People

4. **Action:** Click **People** in the left nav.
   **See:** All 8 profiles in Wellhouse with role + team + department tags. Sara Anwar at the bottom.
5. **Action:** Use the search box "ابحث / Search people or teams…" → type `lina`.
   **See:** Only Lina Farouk's row.
6. **Action:** Clear the search → tap the **Engineering** team chip beside the search box.
   **See:** Only Engineering team members remain (Amira, Yusuf, Hazem). Click **All** to restore.

## 3. Gifts → Overview 🔥

6. **Action:** Gifts → Overview.
   **See:** Four stat cards — Total budget · Remaining · Rewards awarded · Pending fulfillment.
7. **Action:** Check the 3 quick-action cards.
   **See:** "New gift pool" / "Edit catalog" / "Configure tier rewards" navigate correctly.
8. **Action:** Scroll to the activity feed.
   **See:** Rows with employee initials, tier badge, status, time-ago.
9. **Action:** Find a "claimed" row → "Mark fulfilled."
   **See:** Status flips to **Fulfilled**, stat counters refresh.

## 4. Gifts → Catalog 🔥

10. **Action:** Gifts → Catalog → **WH Services** tab.
    **See:** 6 items — Sakoon · Sleep Reset · Stress Less · Empath · Catalyst · Wellbeing Index.
11. **Action:** Add a new WH Services item → save.
    **See:** Persists; visible after refresh.
12. **Action:** Toggle one item to **active = false**.
    **See:** Disappears from the tier picker on the next screen.
13. **Action:** Click **Amazon** tab.
    **See:** "Coming with Tremendous integration" stub.
14. **Action:** Click **Custom** tab.
    **See:** Stub state.

## 5. Gifts → Tier rewards 🔥

15. **Action:** Tier rewards → **Sleep Sprint** challenge.
    **See:** Three rows — Bronze · Silver · Gold.
16. **Action:** Inspect each row.
    **See:**
    - **Bronze:** fixed item = "Wellbeing Index — quarterly review", *allow choice* = OFF.
    - **Silver:** *allow choice* = ON, 2 options (Stress Less + Catalyst).
    - **Gold:** *allow choice* = ON, 3 options (Sakoon + Sleep Reset + Empath).
17. **Action:** On Bronze, flip *allow choice* ON, pick 2 options, save.
    **See:** Saves. In a separate tab as Amira, that gold reward would now offer those options.
18. **Action:** Click the **Pools** tab.
    **See:** Marked "soon" — intentional stub.

## 6. Challenges

19. **Action:** Click **Challenges** in the left nav.
    **See:** "Schedule a challenge" form (Template / Start / End / Scope) + a list of 7 past templates (Energy Boost, Stress Less, Sleep Sprint, Check-in Streak, Mood Lift, Niyyah, Sabr). Header CTA reads **"Schedule challenge"**.
20. **Action:** Pick a template → set dates → Schedule.
    **See:** Saves; appears in the Active list.

> ℹ️ HR schedules from existing templates only. New template authoring happens in the Admin console (Challenge templates section).

## 7. Content

21. **Action:** Click **Content**.
    **See:** ~6 seeded items, EN + AR titles side by side, with Published / Draft badges.
22. **Action:** Toggle one item's **Publish/Unpublish**.
    **See:** Item hidden from the employee Library on the next reload.

## 8. Broadcasts

23. **Action:** Click **Broadcasts** → New → fill EN body → preview card.
    **See:** Gold mark + "WELLNESS+ · From your HR team" header.
24. **Action:** Schedule + send.
    **See:** A notification lands for Amira (check her bell badge in the employee tab).

## 9. Safety + Reports

25. **Action:** Click **Safety**.
    **See:** Any flagged check-ins listed; you can mark one resolved.
26. **Action:** Click **Reports** → Export report (top-right).
    **See:** CSV downloads with weekly aggregates, values noised (differential privacy applied).

## 10. Settings

27. **Action:** Click **Settings**.
    **See:** Sidebar with 7 sections — **Privacy & data** (active) and 6 marked `soon` (Notifications, Roles & permissions, Integrations, Localization, Billing, Audit log).
28. **Action:** In Privacy & data, edit Company name → Save changes.
    **See:** Edits persist after reload.
29. **Action:** Try Minimum cohort size buttons (3 / 5 / 10 / 20).
    **See:** Selection saves; controls the privacy floor on aggregates.
30. **Action:** Scroll to the **Language** panel → tap **العربية**.
    **See:** Entire HR portal flips to Arabic, layout mirrors to RTL. Tap **English** to flip back.

---

# Portal 3 — Admin console · ~10 min

URL: <https://main.d1c79md4n000h6.amplifyapp.com/admin.html>

Sign in as the platform admin (creds provided separately — Sara/Amira do **not** have admin access).

## 1. Platform overview

1. **Action:** Land on Overview.
   **See:** Tenants list with Wellhouse Group + Nile Group, plus Seats / MRR / Status columns.

## 2. Tenant detail

2. **Action:** Open the Wellhouse row.
   **See:** Billing state badge + plan visible.

> ⚠️ **Known gap:** the tenant detail page is **read-only** in this build — Suspend / Reactivate actions land in v1.5.

## 3. Smoke check the other sections

| Section | What to verify |
|---|---|
| Billing | Per-tenant MRR + seats |
| Roles | Role list shows; edit a role |
| Audit log | Recent events visible (e.g. tenant edits) |
| Integrations | List with status |
| Feature flags | Toggle a flag + scope it to a tenant |
| Localization | EN/AR strings editable |
| Challenge templates | List + create one (this is where new HR challenge templates are authored) |
| Global content | List + create one |

---

# Cross-portal validation 🔥 (~5 min)

These prove the three portals actually talk to each other.

1. **Realtime notification.** Send a broadcast from HR. Amira's bell badge increments live, no refresh.
2. **Realtime wallet.** Award a reward to Amira from HR Gifts. With Amira's Mine tab already open, the new row should appear live without refresh.
3. **Catalog → employee picker.** Toggle a WH Services item to *active = false* in HR. As Amira, open the matching gold reward — that option should be gone after refresh.
4. **Sub-5 floor (privacy).** In HR Team breakdown, any team with <5 active users this week should show suppressed metrics — never raw numbers.
5. **Cross-tenant isolation.** Sign up a brand-new user with code `NG-9130` (Nile Group). They should land in Nile Group and see **none** of Wellhouse's data.
6. **HR scope.** Sara (HR, Wellhouse) should see Wellhouse profiles only — never Nile Group.

---

# Go / no-go

| Question | ✅ / ❌ |
|---|---|
| Any P0 (ship-blocker) failure? | |
| Any privacy / cross-tenant leak? | |
| All 🔥 smoke steps green? | |
| Arabic + RTL pass clean across employee + HR? | |
| Offline shell + reconnect works? | |
| Broadcast + challenge leaderboard propagate live? | |

**Tester sign-off:** ____________________  **Date:** ____________________

---

## Known stubs / gaps (not bugs, planned for v1.5)

These are intentional or known-incomplete in this build — flag them only if you think they're a release blocker:

- **HR — Challenges** can only schedule existing templates; new template authoring is in the Admin console
- **HR — Settings sub-tabs** Notifications, Roles & permissions, Integrations, Localization, Billing, Audit log all marked `soon`
- **HR — Gifts → Pools** tab labeled `soon`
- **HR — Gifts → Catalog** Amazon + Custom tabs are stubs (Tremendous integration is post-pilot)
- **Admin — Tenant detail** is read-only (Suspend/Reactivate ships in v1.5)
- **Native iOS / Android wrap** — PWA only for v1
