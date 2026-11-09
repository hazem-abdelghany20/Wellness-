# Sprint plan 2: routines, checklists and libraries

**Source:** client meeting with the first client company's HR lead, Mon 9 Nov 2026 (Egyptian Arabic + English, auto-transcribed) · **Builds on:** [sprint 1](2026-11-09-onboarding-and-challenge-media.md) (join links, CSV import with invite sheets, simple habit-template builder with how-to media, walkthroughs). Nothing here re-plans sprint 1. · **Team:** Hazem (product, review) + Claude (build) · **Dates:** set by Hazem.

**Sprint goal:** an HR admin types in their coach's daily desk routine (times, exercises, sets × reps, demo videos) in a few minutes; every employee opens the app, sees today's list, watches a clip and ticks each item done; HR sees how the company is doing. Then: reminders, a company's own library, HR's own challenges, and an opt-in recognition board.

**Design rule from Hazem:** new first-class things (Exercise, Routine), not more fields stuffed into challenges. One library pattern for everything: Wellness House publishes **public** items for all companies; each company has **private** items its HR creates; HR can use public items inside their company. The client stressed the app must stay very easy, so the employee app keeps four tabs.

---

## 1. What the meeting asked

| # | Ask | Notes / ambiguity |
|---|---|---|
| A1 | **Daily routine in the app.** Their coach wrote a timed plan for the 8-hour workday: at a set time, a named stretch or exercise, with sets/reps. Replace the Excel/PDF they sent. | The transcript says both "8 to 10 sets" and "8 to 10 reps". Model stores sets **and** a rep range. |
| A2 | **Weekly split.** Five workdays, each with a focus (upper body day, lower body day, …). | Unclear if the split is part of the desk routine or a separate after-work plan. The model covers both (see §4). |
| A3 | **Demo video per exercise.** They filmed the coach doing each one. Tap play next to the exercise. | Upload or link both acceptable to them. |
| A4 | **Tick each item, like a checklist.** "Done" per item, per day. | — |
| A5 | **Optional reminder** at each item's time, on iPhone and Android. The employee chooses whether to get it. | Per-employee opt-in. |
| A6 | **HR authors it themselves.** A "+" to add an exercise: time, name, sets/reps, optionally body area / what it helps, video. They have ~20 more to enter. | — |
| A7 | **A picture of the original table** as a fallback reference "if the rest isn't possible". | Cheap; include anyway. |
| A8 | **HR's own ad-hoc challenges**, separate from the routine, e.g. a 2-week "drink water" challenge sent out "suddenly". | They don't mind if "challenge" is a fixed name or a separate thing. |
| A9 | **HR analytics:** who ticked what, which departments use it most, most/least active employees, most/least done exercises. So HR can congratulate, reward (in-app or offline) and push people who aren't doing it. | "Who" is per person. Conflicts with today's aggregate-only HR view (§5). |
| A10 | **A visible "top today"** for employees, e.g. "[employee] is number one today", shown to the whole group. Automatic or HR-triggered? | Hazem said yes in the meeting. Conflicts with "Only you see your points" (§5). |
| A11 | **HR broadcasts, including a "podcast"/audio message** sent at a set time. | — |
| A12 | **HR writes their own articles / facts**, and chooses what to publish. Hazem promised two libraries: a public one shared across all companies and a private one for the company only. | "Facts" may mean short tips. |
| A13 | **Separate dashboards:** employee sees own data, HR sees group analysis. | Already true; neither shows routine data yet. |
| A14 | **Android.** They have Android users. Today = web/PWA + iOS. Options discussed: install the web app, an APK by link outside the Play Store, Play Store later. | — |
| A15 | **Everyone at once.** iOS and Android must get it the same day "so some people don't get it and others don't". | Added: not in the brief. Points to the web app as the launch path. |
| A16 | **Must stay very easy** and flexible, so people don't drop it after day one. | Added. |
| A17 | **Timing.** Client asked for a demo this week; Hazem pushed toward next week, and the HR lead then suggested mid next week "because the changes are many". A campaign start of "1/12" was mentioned. | "1/12" reads as 1 December (day/month), but the replies after it are garbled ("we're on the 9th"). Confirm the date. Hazem promised to send a timeline. |

## 2. What the code does today (checked 9 Nov, `main` at `2033877`)

| Area | Today | Gap |
|---|---|---|
| Routines / exercises | Nothing. The only daily action is the weekly habit challenge: one action, Sun–Thu, one "Did it" per day (`supabase/migrations/20261005000001_habit_challenges.sql`, `src/employee/screens/habit-challenge.jsx`). | No timed items, no multi-item checklist, no exercise entity. |
| HR authoring | HR picks a template and a week (`src/hr/views/challenges.jsx`, `hr_schedule_habit_challenge`). `challenge_templates` has no `company_id` (`20260514000003`). Sprint 1 adds an admin-only builder with media in `payload` (in progress, `20261109000002`). | HR cannot author anything. No company-owned templates. |
| Media storage | Bucket `content-assets`: public read, 50 MB cap, writes Wellness-admin only (`20260519000012`). Sprint 1 adds `.mov`. | HR cannot upload. No private, per-company storage. |
| Content library | `content_items` has no `company_id`; every item is shared (`20240101000004`). HR "Publish/Unpublish" edits the shared row (`src/hr/views/content.jsx`). "Request item" and "Pin to org" buttons have no handler. | **Bug:** policy `content_items_hr_write` (`20260519000002`, line 86) lets any company's HR admin update any item, so one company can unpublish or edit an article for every company. No way for HR to create content. |
| Push / reminders | `push_tokens` table stores only `token` + `platform` (`20240101000007`). No client code registers a token; `public/sw.js` has no `push` handler. `send-push-notifications` posts to the legacy FCM endpoint `fcm.googleapis.com/fcm/send` with a server key, and has a stub comment for APNs. No Capacitor push or local-notification plugin in `package.json`; no iOS entitlements file. | Nothing reaches a locked phone today. The legacy FCM API was shut down in 2024 (appendix R1). Web Push needs `endpoint` + keys, which the table can't hold. |
| Broadcasts | `hr-schedule-broadcast` stores `scheduled_at` but inserts in-app notifications for every recipient **immediately**; nothing ever sets `status = 'sent'`. Text only. | "Send at a set time" doesn't work. No audio. No scheduler (no `pg_cron` in migrations). |
| HR analytics | `hr_participation_overview` returns counts only (members, took part, completed, reads, top articles, 8-week trend), with the company's minimum cohort (`hr_min_cohort`, never below 5). HR People shows name, role, team, no activity. | Nothing on routines, exercises or departments. |
| Employee score | `my_scorecard` / `score_events` (`20261005000004`): +10 per habit day, +20 per completed week, +5 per article. The Score tab says "Only you see your points" and "No names, no ranking" (`src/employee/screens/scorecard.jsx`). | Routine ticks don't count. Any leaderboard contradicts this copy. |
| Consent | Onboarding says "Your HR team only sees participation: who joined a challenge and who completed it" and "Nothing about your health or mood is collected" (`src/employee/i18n.jsx`). `profiles.consent_version` exists (default `v1`). | A named board or per-person HR view needs new wording and a new consent version. |
| Time zone | `companies.settings.timezone` is saved at tenant create (default `UTC`) and never read. Every "today" in SQL is `current_date` on the database clock (UTC), on 34 lines of the `2026100*` migrations. | Egypt is UTC+2 in winter, UTC+3 in summer (appendix R1). "Today" flips at 02:00/03:00 Cairo; a 10:00 reminder needs the company zone. |
| Employee navigation | Four tabs: Challenge · Library · Score · Me (`src/employee/App.jsx`, `TabBar`). | — |
| Native apps | `capacitor.config.json` is iOS only; `ios/` ships the built web app inside the bundle (no `server.url`), currently build 2. No `android/`. The PWA manifest and an install banner (Android Chrome `beforeinstallprompt`) exist. | Every UI change needs a new iOS build. No Android app. |

## 3. Where it lives (keep it easy)

**Employee app: still four tabs.** "Challenge" becomes **Today**.

```
Today · Tue
━━━━━━━━━━━━━━━━━━  4 of 10 done
Next · 10:00  Neck release   2 × 8–10    [▶] [ ○ ]
──────────────────────────────────────────
08:30  Shoulder rolls     2 × 10        ✓
10:00  Neck release       2 × 8–10    ▶ ○
11:30  Wrist stretch      1 × 30 s    ▶ ○
…
Today's focus: Upper body               (weekday split, if any)
  Wall push-ups           3 × 10      ▶ ○
──────────────────────────────────────────
This week's challenge   (existing card, shorter)
See the full schedule →   (week view + the original table picture)
[ Remind me ]  (switch)
```

- Tap ○ to tick; tap again to undo (same day only). Tap a row for a sheet: video, how-to line, sets × reps, a big **Done**.
- Past items say "Not yet", never red or "missed".
- Score tab adds routine days and streak. Library gets **Our company / Wellness House** filter chips. Me gets reminder and recognition switches.

**HR portal:** one new section, **Routines**, between Content and Challenges, with two pages:
- **Routines:** a list (e.g. "Daily desk routine", "Weekly split"). Each opens a table-like builder: rows of *time · exercise · sets × reps · days*, a **+ Add row**, "Attach the original table", "Who gets it: Everyone / a team", start date, and a phone preview.
- **Exercises:** cards in two tabs, **Ours** and **Wellness House**, plus **+ Add exercise**.

Dashboard gets a Routine card linking to the routine report. Content gets **+ Write** and the two-library tabs. Challenges gets **+ Create challenge**. Broadcasts gets **Attach audio**. Settings gets **Recognition**.

**Admin console:** later (P2), the same Exercise and Routine forms with "Public" as the owner.

## 4. Proposed entities and data model

### 4.1 The library pattern (one rule for every type)

Every library table gets `company_id UUID NULL`: **NULL = public** (Wellness House), **set = private** to that company.

| Type | Table | Public items | Private items | How HR uses public ones |
|---|---|---|---|---|
| Articles, facts, audio | `content_items` (+ `company_id`, `created_by`) | Wellness House articles (today's 40+) | HR's own posts | Show as-is; hide or pin per company |
| Exercises | `exercises` (new) | Wellness House movement library (later) | The coach's exercises | Use inside their routines, read-only |
| Routines | `routines` (new) | Ready-made routines (later) | The coach's schedule | **Use this** makes an editable copy |
| Challenge templates | `challenge_templates` (+ `company_id`) | Today's five habits | HR's own (e.g. 2-week water) | Schedule as-is |

**Reference** things you only show (article, exercise). **Copy** things you'd edit (routine). Per-company choices about public items (hide, pin, order) live in a side table, **never** on the shared row:

`company_library_settings (company_id, item_type, item_id, hidden, pinned, sort_order)`, primary key on the first three.

**RLS in plain words, same for all four tables:**
- A signed-in person sees an item if it's published and is public or belongs to their company.
- HR / company admins create, edit and archive items of **their** company only.
- Only Wellness House admins edit public items.
- `company_library_settings`: HR reads and writes rows for their company; employees read them.
- Drop `content_items_hr_write` (the cross-company bug).

### 4.2 New tables

**`exercises`**: one movement with its demo.
`id, company_id NULL, name_en, name_ar, how_en, how_ar (one line), helps_en, helps_ar ("what it helps", optional), body_areas TEXT[] (neck, shoulders, upper_back, lower_back, wrists, hips, legs, eyes, full_body), default_sets, default_reps_min, default_reps_max, default_seconds, media_type (video | image | youtube), media_path, youtube_id, poster_path, status (draft | published | archived), created_by, created_at, updated_at`.
Media fields use the same shape as sprint 1's template `payload` so the same player component works.

**`routines`**: a named schedule.
`id, company_id NULL, title_en, title_ar, note_en, note_ar, source_file_path (picture/PDF of the original table), workdays SMALLINT[] DEFAULT {0,1,2,3,4} (Sun–Thu), status, copied_from UUID NULL, created_by, created_at, updated_at`.

**`routine_items`**: one row of the table.
`id, routine_id, exercise_id NULL, title_en NULL, title_ar NULL (free text, e.g. "Drink a glass of water"), weekday SMALLINT NULL, at_time TIME NULL, sets, reps_min, reps_max, seconds, note_en, note_ar, sort_order`.
- `weekday` NULL = every workday (the desk routine). `weekday` set = that day only (the weekly split). One model covers A1 and A2.
- `at_time` NULL = "any time today" (no reminder).
- A check makes sure either `exercise_id` or a title is set.

**`routine_assignments`**: who gets which routine, when.
`id, routine_id, company_id, team_id NULL (NULL = everyone), starts_on, ends_on NULL, active, created_by`. Several can run at once (desk routine + weekly split). The routine must belong to the same company.

**`routine_checks`**: the tick.
`id, company_id, user_id, routine_id, item_id, check_date (company-local date), checked_at, UNIQUE (user_id, item_id, check_date)`.
- RLS: own rows only. Writes only through `check_routine_item(item_id, done)`, which works out the company-local date, and refuses if the item isn't assigned to the caller, isn't due today, or today isn't a workday.
- A deleted routine item keeps its old checks (`ON DELETE SET NULL` on `item_id`, plus a copied `item_title`) so history and analytics don't change.

**`push_subscriptions`**: replaces the unused `push_tokens` for new code.
`id, user_id, company_id, kind (webpush | apns | fcm | local), endpoint, p256dh, auth, token, platform, user_agent, created_at, last_ok_at, failures`. Own rows only.

**Reminder and recognition preferences** (on `profiles`, or a small `profile_prefs` row): `routine_reminders BOOLEAN DEFAULT false`, `muted_item_ids UUID[]`, `recognition_opt_in BOOLEAN DEFAULT false`, `recognition_opt_in_at`, and `consent_version` moves to `v2` when someone opts in.

**Company settings** (`companies.settings`): `timezone` (default `Africa/Cairo`), `recognition` (`off` | `teams` | `named`, default `off`), `weekly_default_habit` (true/false).

### 4.3 Storage

- New **private** bucket `company-media`, paths `{company_id}/{exercises|routines|content|broadcasts}/{uuid}.{ext}`, 50 MB cap (Hazem: enough), video/mp4, video/quicktime, image/png, image/jpeg, application/pdf, audio/mpeg, audio/mp4.
- Write: HR / company admins, only when the first path segment is their company. Read: members of that company. The app plays videos through signed URLs, and **reuses the same signed URL for a day** so the phone's cache works.
- Public Wellness House media stays in `content-assets`.

### 4.4 Plugging into score and HR analytics

- **Company-local time first:** `company_now(company_id)` and `company_today(company_id)` use the IANA zone in settings (`now() AT TIME ZONE 'Africa/Cairo'`), which handles Egypt's summer time. New code uses them; old `current_date` calls move over in item 1.
- **Score:** `score_events` gains two branches: `routine_item` +2 per item ticked (max 20 a day), and `routine_day` +10 when every item due that day is ticked. Weeks stay Sunday-based. Points on top are decision 6.
- **HR report:** new `hr_routine_overview(p_range)`, same guards and floor as `hr_participation_overview`:
  - today: people assigned, people who ticked at least one item, items done ÷ items due, full days;
  - last 14 workdays: % of due items done;
  - by team / department: members, % active, average items a day. Teams under the floor are grouped as "Small teams";
  - by exercise: times done and % of due, most → least ("least done" = re-explain or re-film it). This ranks exercises, not people, so no floor is needed;
  - by hour: when people actually tick (helps HR pick reminder times).
- **No per-person rows** unless decision 2 says so. **Recognition** (§5) and **nudges** cover congratulating and chasing without HR seeing a list of names.

## 5. Leaderboard and HR per-person view (proposal, needs decisions)

The client wants a visible "top today" and HR wants to know who is active. The product promises "Only you see your points", "No names, no ranking" and "HR only sees participation". Both sides can be met.

| Layer | What it shows | Who sees it | Default |
|---|---|---|---|
| **Team board** | Teams ranked by % of members active this week. No names. Teams under the floor are left out. | Everyone in the company | Off; HR turns on |
| **Named board** | "Did everything today: [names of opted-in people] and 14 more" · "Longest streak this week: top 5 opted-in" | Everyone in the company | Off; HR turns on, **each employee opts in** |
| **HR named list** | The same opted-in names, with days active and items done, so HR can congratulate or reward (in-app gift or offline) | HR / company admin | Follows the named board |
| **Nudge and kudos** | HR picks a group: "hasn't started today", "quiet for 3 days", "finished the week". The app sends the message; HR only sees "Sent to 23 people". Max one nudge per person per day. | The people in the group | Available to HR |

Rules:
- **Effort, never health.** Rank on items ticked and streak days. Nothing about body area, pain or "what it helps" is ever shown next to a name.
- **No last place.** Show top names and "+N more", never a bottom list. Ties are fine (most people will tick everything).
- **Opt-in, not opt-out.** Because of the employer–employee power gap, consent has to be a real choice. Using the app never depends on it. Switch it off any time in Me.
- **Copy changes:** the Score tab line becomes "Only you see your points, unless you choose to show your name on the board". The consent screen gains one line. `consent_version` → `v2` on opt-in.

Consent card, shown once when HR turns the named board on:

> **Show your name on the company board?**
> Your company can show the names of people who did their routine. Only what you did is shown, never anything about your health. You can turn it off any time in Me.
> **[Yes, show my name]** **[Not now]**
>
> **تظهر اسمك في لوحة الشركة؟**
> الشركة ممكن تعرض أسامي الناس اللي عملت الروتين. بيظهر بس اللي عملته، عمره ما هيظهر حاجة عن صحتك. تقدر تقفلها في أي وقت من «أنا».
> **[أيوه، اظهر اسمي]** **[مش دلوقتي]**

Why: a large trial found competition raised activity the most of the three game designs it tested (appendix R5), but legal and consumer guidance warns that rankings create pressure and privacy exposure, and that consent is the defense. Egypt's PDPL treats consent as weak where there is a power imbalance (appendix R6). Opt-in with effort-only data keeps the motivation and limits the exposure.

## 6. Backlog

Estimates: S = 1, M = 3, L = 5 points (as in sprint 1). Build in order.

| # | Priority | Item | Est. | Depends on |
|---|---|---|---|---|
| 1 | P0 | Company-local "today" and time | S | — |
| 2 | P0 | Routine data model, RLS, private `company-media` bucket | M | 1 |
| 3 | P0 | HR: exercise library + Add exercise (video upload, YouTube link, or image) | M | 2; sprint 1 media player |
| 4 | P0 | HR: routine builder (timed rows, weekday split, original table picture) + assign | M | 2, 3 |
| 5 | P0 | Employee: Today tab (checklist, watch, tick) | M | 2, 4 |
| 6 | P0 | HR: routine report v1 (aggregate) | M | 5 |
| 7 | P0 | Library scope fix (per-company hide/pin; HR can't edit shared rows) | S | — |
| 8 | P1 | Reminders in the iOS app (local notifications) + new TestFlight build | M | 5 |
| 9 | P1 | Reminders on the web app (Web Push, sent by a per-minute job) | L | 5 |
| 10 | P1 | Android app by link (Capacitor Android, signed APK) | M | 8 |
| 11 | P1 | Company library: HR writes articles, facts and audio; two-library tabs | M | 7 |
| 12 | P1 | HR's own challenges (private templates, 1–4 weeks, workdays only) | M | sprint 1 #3 |
| 13 | P1 | Broadcasts: send at the set time + audio message | M | 9 for push (in-app works without) |
| 14 | P1 | Score: routine points + streak | S | 5 |
| 15 | P1 | Recognition: team board, opt-in named board, HR nudge/kudos | M | 6, 14, decisions 1–2 |
| 16 | P1 | Import a routine from a sheet + upload many videos at once | M | 3, 4; sprint 1 `sheet-io.js` |
| 17 | P2 | Public exercises / routines / templates by Wellness House + "Use this" | M | 2, 4 |
| 18 | P2 | Server push to native apps (FCM HTTP v1 + APNs), replacing the dead stub | M | 10 |
| 19 | P2 | Google Play listing | M + waiting time | 10, account (decision 3) |
| 20 | P2 | HR per-person participation view | M | decision 2 + legal review |
| 21 | P2 | Export the routine report (CSV/XLSX) | S | 6 |
| 22 | P2 | Record audio in the browser for broadcasts | S | 13 |

**Load:** P0 = 17 points, P1 = 27, P2 = 14. Commit to P0; P1 next, in order.
**Demo slice:** items 1–6 (16 points): HR enters a routine with videos, an employee ticks it, HR sees the report.
**Before employees get it:** P0 + item 9 (the only reminder path that reaches iPhone and Android the same day, A15) + item 13's scheduling fix.

### 1 · Company-local "today" and time (P0, S)
- `company_today()` / `company_now()` read `settings.timezone` (default `Africa/Cairo` for new companies, matching sprint 1 #9).
- Habit challenge, scorecard and HR overview functions switch from `current_date` to `company_today()`.
- **Check:** at 01:00 Cairo on a Monday, the app treats it as Monday (today it's still Sunday in UTC). A test runs with a mocked clock in summer and winter.

### 2 · Routine data model, RLS, private media bucket (P0, M)
- Tables in §4.2, `company_id` on `content_items` and `challenge_templates`, `company_library_settings`, bucket in §4.3. One reviewed SQL file, idempotent, applied by hand (live DB has no migration history).
- **Checks:** an employee of company A cannot read company B's exercises, routines, checks or media files (tested with two demo companies). An employee cannot insert into `routine_checks` directly. HR of A cannot write public rows. Range request on a stored mp4 returns `206` (`curl -H 'Range: bytes=0-1'`).

### 3 · HR: exercise library + Add exercise (P0, M)
- Form: Name (EN; AR optional) · Video (upload or YouTube link) or picture · Default sets × reps (e.g. 2 × 8–10) or seconds · Body area (chips, optional) · What it helps (one line, optional) · How to (one line, optional).
- Upload shows progress; over 50 MB gives a clear message ("Export at 720p or paste a YouTube link") and leaves nothing half-uploaded.
- Ours / Wellness House tabs; edit and archive. Archived exercises leave the picker but stay on routines already built.
- **Checks:** a new exercise with a 40 MB phone video can be added in under a minute and plays inline on iPhone Safari, the iOS app and Android Chrome. Arabic layout is right to left.

### 4 · HR: routine builder + assign (P0, M)
- Rows of time · exercise (pick or create inline) · sets × reps · days (every workday or one weekday). Rows sort by time. **+ Add row** stays visible.
- "Attach the original table" (image or PDF). Phone preview of today's list.
- Assign to everyone or a team (team picker uses sprint 1 #8 when it lands; until then, everyone), from a start date. Editing a routine changes days from today on; past ticks are untouched.
- **Checks:** a 10-row desk routine plus a 5-day split can be entered in under 10 minutes. An employee sees it right after it's saved.

### 5 · Employee: Today tab (P0, M)
- Layout in §3. Only today's items; each can be ticked and unticked until the end of the company-local day.
- Video sheet reuses sprint 1's `habit-media` player: never autoplays, `playsinline`, poster first, `preload="none"` in the list.
- The existing weekly challenge card moves below the routine. With no routine assigned, the tab looks like today's Challenge tab.
- "See the full schedule": week view + the original table picture.
- **Checks:** ticking takes one tap and survives a reload. Works on a 375 px screen in EN and AR. The sprint 1 walkthrough step for this tab is updated.

### 6 · HR: routine report v1 (P0, M)
- §4.4 numbers, as a Dashboard card plus a Routine report page: today, 14-day trend, by team, by exercise (most → least done), by hour.
- **Checks:** numbers match a hand count on seeded demo data. A team under the floor never shows on its own. No person's name appears anywhere.

### 7 · Library scope fix (P0, S)
- Drop `content_items_hr_write`; HR's Publish/Unpublish on a public item writes `company_library_settings.hidden` for their company only. Wire "Pin to org" to `pinned`; remove "Request item" until it does something.
- **Check:** HR of company A hides an article; employees of company B still see it.

### 8 · Reminders in the iOS app (P1, M)
- `@capacitor/local-notifications`. When the employee turns on "Remind me", the app schedules each timed item for each workday on the phone itself. The phone fires them on time, offline, with no server.
- Up to 64 pending notifications on iOS: use weekly repeats (`schedule.on` weekday/hour/minute) while items × workdays ≤ 60, otherwise schedule the next 7 days and refresh on every app open. Re-sync when HR edits the routine.
- Permission is asked on the tap of "Remind me", never at launch. Needs a new iOS build (plugin) and TestFlight.
- **Check:** on a real iPhone, a 10:00 item notifies at 10:00 Cairo time with the app closed; turning the switch off cancels all of them.

### 9 · Reminders on the web app (P1, L)
- Web Push with VAPID keys. `sw.js` gains `push` and `notificationclick` handlers (open Today). Subscriptions go to `push_subscriptions`.
- A `pg_cron` job calls an edge function every minute. It finds items due at this company-local minute for people with reminders on, skips anyone who already ticked it, and sends. Note: `pg_net` calls carry no `Authorization` header unless you add one (store the key in Vault).
- iPhone: works only after "Add to Home Screen" (iOS 16.4+). The switch shows a 3-step "Add to Home Screen" card on iPhone Safari. Android Chrome: works in the browser or installed.
- **Checks:** a test reminder reaches a real Android phone (Chrome) and a real iPhone home-screen app within a minute of its time. A dead subscription is removed after repeated failures.

### 10 · Android app by link (P1, M)
- Add the Capacitor Android platform; same web build; local-notification reminders from item 8; signed release APK on a download page with a short install guide (EN + AR) and screenshots of the "Install unknown apps" and Play Protect screens.
- **Checks:** a non-technical tester installs it from a link in under 3 minutes and gets a reminder. The APK is signed with a key kept safe for later Play Store use.

### 11 · Company library (P1, M)
- HR **+ Write**: article (title, body, optional cover), fact (one or two lines, shown as a card), audio (upload). Draft / Publish. Only their company sees it.
- Library: **Our company / Wellness House** chips; pinned items first.
- Reads of company items count in `hr_participation_overview` and points, like public ones.
- **Checks:** an article written by HR of A is invisible to B. An employee sees it the moment it's published.

### 12 · HR's own challenges (P1, M)
- HR gets sprint 1's simple builder in the HR portal, saving a template with their `company_id`.
- Length 1–4 weeks, Sun → Thu each week, workdays only; "days needed" defaults to 80% (8 of 10 for two weeks). Fri/Sat can't be logged.
- HR's challenge takes the place of the default weekly habit for those weeks (the default gives way, as it does today).
- **Checks:** a 2-week water challenge runs 10 workdays, shows "3 of 10" correctly, and awards at 8. Another company can't see the template.

### 13 · Broadcasts at the set time + audio (P1, M)
- Scheduling fix: create only the `broadcasts` row; a per-minute job (same as item 9) delivers due ones (in-app + push) and sets `status = 'sent'`.
- Optional audio (mp3 / m4a, ≤ 50 MB) plays in the notification view; optionally saved to the company library.
- **Checks:** a broadcast set for 14:00 appears at 14:00, not when it was written. Cancelling before 14:00 stops it.

### 14 · Score: routine points + streak (P1, S)
- `score_events` branches from §4.4. Score tab shows routine days this week and current streak (workdays with at least one tick in a row; Fri/Sat don't break it).
- **Check:** ticking all items on a day adds the expected points once, even after untick/retick.

### 15 · Recognition (P1, M)
- Settings → Recognition: Off / Team board / Team + named board. Consent card (§5). Me → "Show my name on the board" switch.
- Today tab shows the board in one line ("Top team this week: Finance · 3 of you did everything today"), with a "See board" link.
- HR: Recognition page with the opted-in list, and Nudge / Kudos by group.
- **Checks:** a person who never opted in never appears by name for anyone. Turning the company switch off hides the board within a minute. A nudge reaches a person at most once a day.

### 16 · Import a routine from a sheet (P1, M)
- Upload the coach's sheet (CSV/XLSX, via sprint 1 `sheet-io.js`) with columns time, exercise, sets, reps, weekday, body area, video link. Preview with row problems, then save as a routine.
- Drop many video files at once; each is matched to an exercise by file name, unmatched ones are listed.
- **Check:** the client's real sheet imports with no manual fixes beyond flagged rows.

### 17–22 (P2)
- **17** Wellness House authors public exercises, routines and templates in the admin console; HR taps "Use this" to copy a routine into their company.
- **18** Rewrite `send-push-notifications` for FCM HTTP v1 (Android) and APNs or FCM (iOS), so broadcasts reach native apps with the screen locked.
- **19** Play Store: organization developer account, store listing, review. See appendix R2 for waiting times.
- **20** HR per-person view: only if decision 2 says yes and a lawyer agrees. Participation counts only.
- **21** Export the routine report.
- **22** Record a voice note in the browser for a broadcast.

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The iOS app ships the web build inside it | Every change needs a new build; TestFlight builds expire after 90 days; the first external build needs Apple's beta review | Launch on the web app for everyone (A15); the iOS app is a bonus until it's on the App Store (decision 4) |
| Video egress | Hundreds of people watching 25–40 clips can use tens of GB a month; the Free plan includes 5 GB | Confirm the plan (decision 7); 720p H.264 with fast start, about 3–10 MB per 30–60 s clip; poster images; reuse signed URLs for a day |
| iPhone Safari needs `206` range responses for video | Clips fail to play on iPhone | Check with `curl` and a real iPhone before the demo (item 2) |
| YouTube embeds need an HTTP referrer | Linked videos may show an error inside the iOS app (its pages load from `capacitor://`) | Test early; prefer uploads for the coach's clips |
| Too many notifications (10 a day) | People turn them all off or uninstall | Off by default; per-item mute; skip if already ticked |
| Ticks are self-reported | Gaming the board | Rank effort with a daily cap; ties allowed; no prizes for rank alone |
| Privacy promise and Egypt's PDPL | Breaking in-app promises; legal exposure for the client and Wellness House | Opt-in names only (§5); update copy; get an Egyptian data-protection review before item 20; data processing terms with the client |
| Live database has no migration history | SQL must be applied by hand; drift | One reviewed SQL file per item; apply the Oct 4 security fixes first (sprint 1 risk) |
| Sprint 1 is being built right now in the same files | Merge conflicts in `habit-challenge.jsx`, HR challenges, `supabase-hr.ts` | Start after sprint 1 merges, or put new work in new files and only compose the existing challenge card |
| Android APK by link | "Install unknown apps" and Play Protect warnings scare non-technical staff; from 2027 Google plans to require a verified developer for apps on certified phones | Web app first; install guide with screenshots; register as a verified developer now |
| Legacy FCM code looks like it works | It no-ops without a key and the endpoint is retired | Don't rely on it; item 18 |
| Scope | P0 + P1 = 44 points | Commit to P0; P1 in order; cut 16 before 15 |

## 8. Open questions / decisions for Hazem

1. **Leaderboard:** off, team board only, or team board + opt-in named board? (Recommend the last, company switch off by default.)
2. **Names for HR:** only people who opted in (recommend), or everyone's participation counts? Anything wider needs a lawyer's read.
3. **Android at launch:** web app for everyone (recommend), APK by link for those who want it. Does Wellness House have a Play Console account or a D-U-N-S number?
4. **iPhone at launch:** web app on the Home Screen, or the TestFlight app? Is an App Store release planned?
5. **Default weekly habit:** turn it off for this company while the routine runs? (Recommend yes; HR's own challenges still work.)
6. **Points:** +2 per item (max 20 a day) + 10 for a full day. OK?
7. **Video hosting:** Supabase Storage (recommend). Which Supabase plan is the live project on?
8. **Who enters the 20+ exercises** for the demo: HR, or Wellness House from the coach's sheet?
9. **Their workweek and hours:** Sun–Thu? Same times for everyone, no shifts?
10. **"Facts":** a new short card type (as planned in item 11), or just short articles?
11. **Rewards for the routine:** in-app gifts (existing gift engine) or offline only?
12. **Campaign date:** is "1/12" 1 December?

## 9. Definition of done

- [ ] Works on the live site in EN and AR, on a phone-sized screen
- [ ] Unit tests pass; new logic (company-local date, due items, check rules, scoring, report numbers, reminder scheduling) has tests
- [ ] SQL reviewed and applied to the live project; two-company RLS test passes
- [ ] Videos play on iPhone Safari, the iOS app and Android Chrome; reminders tested on a real iPhone and a real Android phone
- [ ] No team under the company's minimum cohort is shown on its own; no name appears without opt-in
- [ ] Privacy copy (consent screen, Score tab, HR Settings) updated in EN + AR wherever behaviour changed
- [ ] Walkthrough and guide updated for anything that changed on screen
- [ ] Demo data (Wellhouse Group) has a routine and still looks right

---

## Appendix: research (checked 9 Nov 2026)

### R1 · Timed reminders

| Path | What works | Limits |
|---|---|---|
| **Web Push, iPhone** | Standard Web Push (Push API + service worker) for web apps added to the Home Screen, iOS/iPadOS 16.4+. No Apple developer account needed. Permission must be asked in response to a tap. Manifest `display` must be `standalone` or `fullscreen` (ours is). Declarative Web Push added in iOS 18.4. | Not available in plain Safari tabs. The server must send each reminder at the right time. |
| **Web Push, Android** | Chrome supports Web Push in the browser and when installed. | Same: server sends at the right time. |
| **Scheduling on the web** | Chrome's Notification Triggers (scheduling a notification inside the browser) only reached an experiment; nothing to build on. | So web reminders need a server job. |
| **Server job** | Supabase Cron (`pg_cron` + `pg_net`) can call an edge function every minute; keys belong in Vault. | — |
| **Local notifications (native)** | `@capacitor/local-notifications` v8: `schedule.on` (weekday, hour, minute) repeats like cron; Sunday = 1. Fires with no server and no network. Android 13+ needs the notification permission (requested automatically since 8.3.0); Android 12+ needs `SCHEDULE_EXACT_ALARM` for exact times. | iOS keeps only the soonest 64 pending local notifications. |
| **Server push to native** | `@capacitor/push-notifications`: on iOS `register()` returns an APNs token, on Android an FCM token. iOS needs the Push Notifications capability. | The legacy FCM HTTP API (server key, `/fcm/send`) was shut down in mid-2024; use FCM HTTP v1 (OAuth). |
| **Egypt time** | Summer time from the last Friday of April to the last Thursday of October. In 2026: 24 Apr → 30 Oct. UTC+3 in summer, UTC+2 now. | Store an IANA zone (`Africa/Cairo`), never a fixed offset. |

**For "remind me at 10:00 every workday":** native apps schedule on the phone (most reliable, offline); the web app needs the per-minute server job. Launch with Web Push because it is the one path that reaches both iPhone and Android the same day.

### R2 · Android delivery, fastest to slowest

| Path | Time to employees | Friction | Notes |
|---|---|---|---|
| **Install the web app** (Chrome → Install) | Same day | Lowest. Same link as everyone | Web Push reminders; our install banner already handles Android Chrome |
| **APK by link** (Capacitor Android, or a Trusted Web Activity) | 2–4 days to build and test | "Install unknown apps" prompt; Play Protect may warn about an unknown developer | A TWA needs `/.well-known/assetlinks.json` matching the signing key. Google's developer verification for apps on certified phones started 30 Sep 2026 in a few countries (not Egypt) and is planned globally in 2027; register as a verified developer now. A free "limited distribution" account covers up to 20 devices |
| **Google Play, personal account** | ≥ 3 weeks after the account is ready | 12 testers opted in for 14 days in a row, then production review (usually ≤ 7 days) | Applies to personal accounts created after 13 Nov 2023 |
| **Google Play, organization account** | Roughly 2–6 weeks | Needs a D-U-N-S number (free, can take up to about 30 days) | Google's testing-rule page only talks about personal accounts; confirm in Play Console |

### R3 · Video hosting for ~25–40 short clips, one company, hundreds of employees

| Option | Fit | Notes |
|---|---|---|
| **Supabase Storage** (recommend) | Good at this scale | Free: 50 MB per file, 1 GB storage, 5 GB egress + 5 GB cached egress a month. Pro: 100 GB storage, 250 GB egress + 250 GB cached egress included, larger files allowed. No transcoding: compress to 720p H.264 MP4 with fast start before upload. Supabase announced range-request support for media in 2021; still verify the `206` response (Safari needs it). |
| **YouTube unlisted** | Fallback | No size or egress worries. Anyone with the link can watch; related videos (same channel) can't be turned off; `playsinline=1` for inline iPhone playback; embeds need an HTTP referrer or show error 153. |
| **Bunny Stream** | Later | Adaptive streaming, free standard encoding, cheap storage and delivery. Worth it at several companies or longer videos. |
| **Mux** | Not now | Free plan stores only 10 videos. |

### R4 · Micro-break apps: what to copy, what to avoid

- **Copy:** one short clip per move, then a big Done; a "next up" line; reminders the user controls, and a way to switch them off; break goals and simple progress. Micro-breaks of up to 10 minutes give a small, real lift in energy and less fatigue (meta-analysis of 22 samples, 2,335 people), so keep each item short.
- **Avoid:** autoplaying videos in a list; red "missed" states; forcing every reminder on; long sessions that don't fit the workday.

### R5 · Leaderboards at work

- STEP UP trial (JAMA Internal Medicine, 2019; 602 adults, 24 weeks): support, collaboration and competition designs all increased daily steps; competition increased them most (about +920 steps a day) and was the only one still ahead after the game ended.
- Legal and consumer guidance: rankings can create pressure and expose employees; consent is the usual defense; be careful with competitive programs. Evidence that wellness programs change health outcomes is thin, so keep the board about showing up, not results.

### R6 · Egypt's Personal Data Protection Law (Law 151 of 2020)

- Executive Regulations issued 1 Nov 2025 (Ministerial Decree 816/2025), made public 25 Dec 2025. One-year grace period: on a strict reading, enforcement starts 1 Nov 2026.
- Consent must be explicit, informed, specific and freely given, easy to withdraw, and recorded. It is a weak basis where a real choice is hard, such as a power imbalance (employer and employee). Health data gets extra protection.
- Controllers and processors need a licence; legal entities appoint a data protection officer; transfers outside Egypt (including cloud hosting) need a licence or permit; breaches go to the regulator within 72 hours.
- This is not legal advice. Before HR sees any per-person data, get an Egyptian data-protection lawyer to confirm the roles (client = controller, Wellness House = processor?), the lawful basis and the hosting location.

### Sources

- WebKit, "Web Push for Web Apps on iOS and iPadOS" (Feb 2023): https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- WebKit, "WebKit Features in Safari 18.4" (Mar 2025): https://webkit.org/blog/16574/
- Chrome for Developers, Notification Triggers API: https://developer.chrome.com/docs/web-platform/notification-triggers
- Supabase, Scheduling Edge Functions: https://supabase.com/docs/guides/functions/schedule-functions
- Supabase, pg_cron: https://supabase.com/docs/guides/database/extensions/pgcron
- Capacitor, Local Notifications API (v8): https://capacitorjs.com/docs/apis/local-notifications
- Capacitor, Push Notifications API: https://capacitorjs.com/docs/apis/push-notifications
- Apple Developer Forums, local notification limits: https://developer.apple.com/forums/thread/682509
- Expo, "FCM v1 migration deadline changed to July 20th" (2024): https://expo.dev/blog/fcm-v1-migration-deadline-changed-to-july-20th
- timeanddate.com, Egypt time changes 2026: https://www.timeanddate.com/time/change/egypt?year=2026
- Egypt Today, "When will daylight saving time end in 2026?": https://www.egypttoday.com/Article/1/149096/When-will-daylight-saving-time-end-in-2026
- Google Play Console Help, app testing requirements for new personal developer accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- Google, Understanding Android developer verification: https://support.google.com/android-developer-console/answer/16561738
- Android Authority, sideloading changes timeline (2026): https://www.androidauthority.com/android-sideloading-changes-timeline-3679204/
- Android Developers, Trusted Web Activities quick start: https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2
- Capawesome, install an APK on an Android device: https://capawesome.io/cloud/native-builds/guides/install-apk-on-android-device
- Apple, TestFlight overview: https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
- Supabase, pricing: https://supabase.com/pricing
- Supabase, billing on Supabase: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase, upload file size restrictions: https://supabase.com/docs/guides/troubleshooting/upload-file-size-restrictions-Y4wQLT
- Supabase, "Storage is now in Beta" (2021, range requests): https://supabase.com/blog/storage-beta
- WebKit Bugzilla 211295 (Safari media needs 206 range responses): https://bugs.webkit.org/show_bug.cgi?id=211295
- YouTube Help, change video privacy settings: https://support.google.com/youtube/answer/157177
- YouTube IFrame Player parameters: https://developers.google.com/youtube/player_parameters
- Bunny Stream pricing docs: https://docs.bunny.net/stream/pricing
- Mux, free plan (May 2025): https://www.mux.com/docs/changelog/video-free-plan
- Albulescu et al., "Give me a break!", PLOS ONE (Aug 2022): https://pubmed.ncbi.nlm.nih.gov/36044424/
- StretchMinder product listing: https://alternativeto.net/software/stretchminder/about/
- Patel et al., STEP UP trial, JAMA Internal Medicine (2019): https://pubmed.ncbi.nlm.nih.gov/31498375/
- Penn Today, "Competition works better than support or collaboration" (2019): https://penntoday.upenn.edu/news/competition-works-better-support-or-collaboration-increase-daily-step-counts
- Fisher Phillips, "Ready Employer One: gamifying the workplace" (2020): https://www.fisherphillips.com/print/v2/content/18254/ready-employer-one-what-employers-need-to-consider-when-gamifying-the-workplace.pdf
- Consumer Reports, workplace wellness programs and privacy: https://www.consumerreports.org/health-privacy/are-workplace-wellness-programs-a-privacy-problem/
- CMS, "Egypt's PDPL: Executive regulations issued" (2026): https://cms.law/en/are/legal-updates/egypt-s-pdpl-executive-regulations-issued-one-year-compliance-countdown-begins
- Al Tamimi, "Egypt issues Executive Regulations of the PDPL": https://www.tamimi.com/law-update/general/articles/from-policy-to-practice-egypt-issues-executive-regulations-of-the-personal-data-protection-law/
- Kennedys, "Egypt's PDPL: the compliance countdown has begun" (2026): https://www.kennedyslaw.com/en/thought-leadership/article/2026/egypt-s-personal-data-protection-law-the-compliance-countdown-has-begun
