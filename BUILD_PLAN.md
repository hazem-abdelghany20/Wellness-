# Wellness+ — v2 Build Plan

Prepared by Hazem · 2026-05-04 · responding to Wireframe Deck v2 (MASTER_PLAN v3)

## Where we are

Repo state in `Wellness-`:

- Three SPAs running on shared Supabase: employee · HR · admin
- ~7,000 LOC, iOS Liquid Glass components inline, brand kit applied
- 14 migrations live: `companies`, `profiles`, `checkins`, `content`, `challenges`, `daily_plan`, `notifications`, `hr_aggregates`, `pending_associations`, `insights`, `storage_policies`, `auth_hooks`, `realtime`, `functions`
- 9 edge functions: `compute-hr-aggregates`, `generate-daily-plan`, `generate-insights`, `refresh-leaderboard`, `send-push-notifications`, `update-challenge-activity`, `verify-company-code`, `delete-account`
- v1 wireframes shipped; v2 features (latest deck) not yet built

## Scope from v2 deck

1. **HR Gifts engine** — 4 screens (overview · catalog · tier config · configure-per-competition)
2. **Employee Rewards Wallet** — 3 screens (Mine-tab hero · choose-from-options · claim flow)
3. **Today-screen tier indicator** — update streak card with tier badge + progress to next tier
4. **Sabr signature competition** — 21-day path, Arabic typography, DBT + sabr framing
5. **Niyyah signature competition** — 7-day intention sprint, warm earth palette
6. **Ramadan Mode** — adaptive timing (iftar/suhoor-aware), sunset palette
7. **Privacy hardening** — 5+ floor on aggregates, ε=2 on insights edge function
8. **PWA shell** — installable, service worker, Lighthouse 90+

## Explicitly deferred to v1.5 / v2

- Tremendous API integration — claim flow ships with manual fulfillment placeholder
- Native iOS / Android via Capacitor — web/PWA only for v1
- App Store + Google Play submission
- Adam Design Mode 6 polish (Imagen 4 mockups, sound design, motion language)
- Empath copy review pass (initial pass yes; full polish later)

## Sequence — 10 working weeks, Hazem solo + AI-assisted

### Sprint 0 — Foundation (weeks 1-2)

- Gifts data model: migrations for `gift_pools`, `tier_configurations`, `awarded_rewards`, `gift_redemptions`, `gift_catalog_items`
- Today screen tier badge + progress bar on streak card (lightweight, high-impact)
- Wallet hero list (Mine tab) — read-only, lists awarded rewards by status

### Sprint 1 — HR Gifts engine (weeks 3-4)

- HR Gifts overview (4 stat cards + 3 quick actions + activity feed)
- HR Gift catalog — WH Services tab full (Amazon + Custom tabs are visual stubs)
- Tier-color tokens locked into design system

### Sprint 2 — Tier config + choose flow (weeks 5-6)

- HR per-competition tier configuration (Bronze · Silver · Gold)
- "Allow employee choice" toggle exposing multi-option picker
- Employee choose-from-options screen
- Manual claim flow: "Ready" → "Claimed" → HR marks "Fulfilled"

### Sprint 3 — Signature competitions (weeks 7-8)

- Sabr (21d) — competition detail, daily practice cards, Arabic large display
- Niyyah (7d) — sprint structure, implementation-intention prompts
- Ramadan Mode — adaptive rhythm view, Cairo iftar/suhoor calc

### Sprint 4 — Privacy + PWA + Foundever readiness (weeks 9-10)

- 5+ floor enforced in `compute-hr-aggregates` edge function
- ε=2 differential privacy on insights aggregations
- PWA install flow, service worker, offline shell
- Demo seed data tuned for Foundever first walkthrough
- Audit pass: empty states, errors, offline, loading, accessibility

## What I need from Has

1. **Foundever pilot date** — anchors the 10-week calendar. If pilot is sooner, tell me what to drop or compress.
2. **WH Services SKU list** with current prices and the discount tier Foundever sees (25% standard / 30% bulk / 35% strategic). Without this, catalog screens show placeholder data.
3. **Tier reward defaults** — for each of Sakoon, Sleep Reset, Stress Less, what does "Wellness+ recommends" map to in actual SKUs?
4. **Privacy posture confirmation** — confirm 5+ floor + ε=2 are hard requirements (not aspirational).
5. **Foundever HR contact** — useful to spec auth + onboarding flow against their actual setup.

## Architecture notes

- Multi-tenancy via `companies` table + RLS (already in repo)
- Auth via Supabase Auth + `verify-company-code` edge function (already wired)
- Gift fulfillment v1 = manual; HR sees "Claimed by employee" → marks fulfilled. Tremendous API slots in cleanly later via `awarded_rewards.fulfillment_method` field.
- Sabr / Niyyah / Ramadan Mode reuse existing `challenges` model with new `theme` + `cultural_context` columns
- Privacy primitives (5+ floor + ε=2) at edge-function aggregation layer, not raw RLS — keeps row-level access pattern unchanged

## Calendar realism

Saden Phase 0 starts ~mid-May once SO-SADEN-002 is signed. Catalyst has 4 programs launching May–June. Wellness+ build is real but bandwidth is shared — calendar above assumes ~10–15 productive hours/week on Wellness+, amplified by AI tooling. If Foundever pilot lands in mid-July, this plan fits. Earlier compresses scope; tell me what stays.

## Risks / blockers

- **Foundever timeline drift** — if pilot date moves earlier than mid-July, scope must compress (Sabr/Niyyah/Ramadan can defer; HR Gifts core can't)
- **Bandwidth conflict** — Saden Phase 0 Wave 1 (Days 1-7) is heavy CTO load. Wellness+ velocity drops to near-zero that week. Plan absorbs one such week; two means a sprint slips.
- **Privacy implementation complexity** — ε=2 differential privacy on insights is non-trivial. If it stalls, ship 5+ floor only in v1 and defer ε=2 to v1.5.
- **Manual gift fulfillment friction** — first 50-100 redemptions may surface UX gaps that argue for Tremendous earlier than v2.

## Open questions

1. Auth model for Foundever employees — company code + email (current), or SSO via SCIM? Affects Sprint 4.
2. Data residency for Foundever — KSA / Egypt / EU? Drives Supabase region choice.
3. Capacitor wrap timing — v1.5 (post-pilot) or v2? Affects whether Sprint 4 includes a thin native bridge stub.
4. Adam Design Mode 6 pass — does Has run it before pilot or after? If before, schedule blocks 1-2 sprints for design-feedback iteration.
