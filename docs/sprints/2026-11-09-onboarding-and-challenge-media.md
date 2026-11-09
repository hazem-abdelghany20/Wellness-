# Sprint plan: onboarding and challenge media

**Source:** Wellness House demo meeting, Mon 9 Nov 2026 · **Dates:** started Mon 9 Nov, same day (Hazem: "I want it in now") · **Team:** Hazem (product, review) + Claude (build)

**Sprint goal:** a new company goes from "created" to hundreds of employees using the app in one sitting, Wellness House can publish a challenge with a how-to video, and every role gets a guided first run.

## What the meeting decided

- **Wellness House authors challenges, HR assigns them.** The Wellness House admin builds challenge templates; each company's HR picks one per week and assigns it to all staff or a team. HR does not author templates in this sprint.
- **A challenge can carry a how-to video or image.** Uploaded file, not YouTube. The employee watches it, then does the habit.
- **The template form is too complicated.** Cut it down to the fields that matter.
- **Bulk employee upload is required.** Companies arrive with 50, 100 or 500 employees; adding them one by one is not an option.
- **Tenant onboarding must be smoother.** In the meeting, "Invite admin" appeared to do nothing.
- **Teams** (Finance, Tech, …) hold employees; the dashboard should show them more clearly.
- **Added after the meeting:** an onboarding guide and in-app walkthrough for every role.

## What the code does today (checked 9 Nov)

| Area | Today | Gap |
|---|---|---|
| Template form (admin) | Fields: slug, EN/AR title, window days, target, metric | Builds old "metric" challenges. Cannot author a weekly habit (action, why, tip, reminder). The five live habits were seeded by hand in a migration. |
| Media | Storage bucket `content-assets` exists: 50 MB cap, mp4 / png / jpeg allowed | No media field on templates or challenges; nothing shows it to employees. |
| Invite admin | `admin_invite_company_admin` only pre-approves the email | **No email is sent.** The invitee never hears about it. |
| Employees | Self sign-up with company code + email | No import. No way to pre-place people in teams. |
| Employee sign-in | Company code field is pre-filled with `WH-4782` | **Bug:** a real client's employees would see the demo company's code. |
| Teams | Read-only in HR | No create, rename or move. |
| Tenant create | Name, language, free-text timezone (the "UTC" box from the meeting), plan | Timezone is free text; no next step after creating. |
| Walkthroughs, guides | None | All roles. |

## Sprint backlog

Estimates: S = 1, M = 3, L = 5 points. Build order follows the dependency column.

| # | Priority | Item | Est. | Depends on |
|---|---|---|---|---|
| 1 | P0 | Join link per company | S | — |
| 2 | P0 | Employee import from CSV | L | 1 |
| 3 | P0 | Simple habit template builder (admin) | M | — |
| 4 | P0 | How-to video / image on a challenge | M | 3 |
| 5 | P0 | First-run walkthrough for every role | M | 1–4 (tours point at the new screens) |
| 6 | P0 | Onboarding guide for every role (EN + AR) | S | 5 |
| 7 | P1 | Real admin invite email + status | M | Email provider (open question 1) |
| 8 | P1 | Team management (HR) | M | 2 |
| 9 | P1 | Tenant setup wizard (admin) | S | 1, 7 |
| 10 | P1 | Team view on the HR dashboard | M | 8 |

**Load:** P0 = 16 points, P1 = 10 points. Commit to P0; P1 is the stretch, in order.

### 1 · Join link per company (P0, S)
Each company gets one link, e.g. `…/join/WH-4782`, plus a QR code. HR copies it from Settings and the dashboard.
- Opening the link fills the company code; the employee types only email and password.
- The `WH-4782` default is removed; the plain sign-in page starts with an empty code.
- An employee whose email was imported (item 2) can sign in without any code.

### 2 · Employee import from CSV (P0, L)
HR (for their company) and the Wellness House admin (for any company) upload a CSV with `name, email, team, role` (role optional, default employee).
- Downloadable template file. Accepts `.csv` (Excel → Save as CSV).
- Preview before saving: row count, new teams to be created, and every problem row (bad email, duplicate, unknown role) with the reason. Problem rows can be skipped.
- 500 rows import in one go, in under 10 seconds.
- Imported people are pre-registered: when they first sign in they land in the right company and team with no code.
- HR sees who has joined and who hasn't.
- Re-uploading the same file changes nothing (no duplicates).

### 3 · Simple habit template builder (admin) (P0, M)
Replace the current form with the fields an author thinks in:
- Name (EN, AR) · Category: Movement, Sleep, Mood, Hydration, Stress · The daily action (EN, AR) · Why it helps (EN, AR) · Tip (optional) · When it's checked: same day / next morning · Days needed to win: 4 of 5 (default) · Related article (optional).
- Removed from the form: slug (generated), window days (always Sun–Thu), target, metric.
- Live preview of the employee's Challenge card while typing.
- Edit and archive existing templates; archived ones stop appearing in HR's picker.
- A new template appears in HR → Challenges straight away.

### 4 · How-to video / image on a challenge (P0, M)
- The admin uploads one video (mp4/mov) or image on the template. Upload progress shown.
- The employee's Challenge tab shows "Watch how" above "Did it today"; it plays inline on the phone, muted autoplay off.
- Size cap: 50 MB today (see open question 3). Over the cap: clear message, nothing half-uploaded.
- YouTube links are out of scope (decided in the meeting).

### 5 · First-run walkthrough for every role (P0, M)
A short guided tour on first sign-in, 3–5 steps each, skippable, replayable from a "?" menu. Remembered per account, so it doesn't repeat on another device.
- **Employee:** this week's challenge → "Did it today" → the team bar → Library → Score (what's private).
- **HR admin / company admin:** dashboard (participation only) → pick a challenge → import people → share the join link.
- **Manager:** what they can and cannot see about their team.
- **Wellness House admin:** create a company → invite its admin → build a template with a video → content library.
- Works in Arabic, right to left.

### 6 · Onboarding guide for every role (P0, S)
One page per role, EN + AR, reachable from the "?" menu and shareable as a link (and PDF) to send with a contract. Same order as the walkthrough, plus "who to contact". Screenshots from the live build.

### 7 · Real admin invite (P1, M)
- "Invite admin" sends an email with a one-click sign-in link to the HR portal.
- Tenant page shows each invite as Pending / Joined, with Resend.
- Needs a sender (open question 1). Until then: show a copyable invite link instead of saying "Invite sent".

### 8 · Team management (P1, M)
HR creates, renames and deletes teams, moves people between teams, and marks a team lead (manager).

### 9 · Tenant setup wizard (P1, S)
Admin flow in one place: company name → language → timezone (dropdown, default Africa/Cairo) → plan → invite admin → shows the join link and import button. Replaces the free-text "UTC" box.

### 10 · Team view on the HR dashboard (P1, M)
Per team: members, joined, took part this week, completed. Teams under 5 people are grouped as "Small teams" so no one can be singled out (same 5-person rule as today).

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Phone videos are often over 50 MB | Upload fails for the people authoring | Compress in the browser before upload, or raise the cap (question 3) |
| Supabase's built-in email sends only a few emails per hour | Invites and any bulk emails stall | Custom sender (question 1); copyable links meanwhile |
| The live database has no migration history linked to this repo | New tables/columns must be applied by hand in the SQL editor, like today's demo script | One reviewed SQL file per item, run by Hazem; get CLI access to the project |
| The Oct 4 security fixes (self-promote to HR admin, cross-company reads) are in the repo but not on the live database | Real client data at risk once companies onboard for real | Apply them before the first real import (add to item 2's checklist) |

## Answers (Hazem, 9 Nov)

1. **No email sending.** Invites are handed out as Excel sheets of personal links. Item 7 becomes "invite sheet", not email.
2. **HR admin and company admin are one role** in the UI, walkthroughs and guides.
3. **50 MB video cap is enough.**
4. **Both** HR and the Wellness House admin can import employees.
5. **"Send the link and they go straight in" = the join link** (item 1).
6. **Build now**, no sprint dates.

## Found while building

- **Sign-up never reads invites.** The sign-up trigger only uses the company code, so "Invite admin" did nothing and a new company's HR admin could not get in at all. Fixed in item 2's database change: invites carry a personal token; HR-admin access is granted only through that token, because email confirmation is off.

## Definition of done
- [ ] Works on the live site in EN and AR, on a phone-sized screen
- [ ] Unit tests pass; new logic (CSV parsing, import, template save) has tests
- [ ] SQL changes reviewed and applied to the live project
- [ ] Walkthrough and guide updated for anything that changed on screen
- [ ] Demo data (Wellhouse Group) still looks right after the change
