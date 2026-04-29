# Wellness+ Employee App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [docs/superpowers/specs/2026-04-30-employee-app-design.md](../specs/2026-04-30-employee-app-design.md)

**Goal:** Stand up the Supabase Cloud project from the existing scaffolding, refactor the bundled `src/main-employee.jsx` into per-screen modules under `src/employee/`, and wire every screen to the backend through `src/lib/supabase.ts`.

**Architecture:** Backend-first bring-up so the dev environment is real before any wiring lands. Frontend refactor is a *verbatim* structural extraction (Phase 2-3) followed by a data-wiring pass (Phase 5-6). State stays on `useState`/`useEffect` with two Contexts (`AuthContext`, `AppConfigContext`); data access is via thin hooks that call the existing `src/lib/supabase.ts` helpers. No new dependencies beyond Vitest for hook tests.

**Tech Stack:** React 18, Vite 6, Supabase (Postgres + Auth + Edge Functions + Realtime + Storage), `@supabase/supabase-js` v2, Vitest + @testing-library/react for hook tests.

**Out of scope (per spec):** HR Portal wiring, Admin Console wiring, native push delivery, native shells, offline-first sync.

---

## File Structure

The end-state file tree under `src/`:

```
src/
  main-employee.jsx                   # entry — imports App, mounts root
  main-hr.jsx                         # untouched (HR sub-project)
  main-admin.jsx                      # untouched (Admin sub-project)
  lib/
    supabase.ts                       # existing client wrapper (extended)
  employee/
    App.jsx                           # routing + Tweaks shell
    design-system.jsx                 # THEMES, typeStyles, Icon, Card, etc.
    i18n.jsx                          # STRINGS, useT
    ios-frame.jsx                     # IOSDevice + nav/list/keyboard
    confetti.jsx                      # Confetti
    tweaks-panel.jsx                  # dev-only Tweaks panel
    state/
      auth-context.jsx                # session, profile, company
      app-config-context.jsx          # theme, lang, density, variants
    hooks/
      use-profile.js
      use-checkin.js
      use-daily-plan.js
      use-content.js
      use-challenges.js
      use-progress.js
      use-notifications.js
      use-insights.js
      __tests__/
        use-checkin.test.js
        use-daily-plan.test.js
        use-content.test.js
        use-challenges.test.js
        use-progress.test.js
        use-notifications.test.js
    screens/
      onboarding.jsx                  # ScreenJoin/OTP/Consent/Name/Baseline/Goals/Welcome
      home.jsx                        # ScreenHome
      checkin.jsx                     # ScreenCheckIn
      breathe.jsx                     # ScreenBreathe
      challenges.jsx                  # ScreenChallenges
      progress.jsx                    # ScreenProgress
      profile.jsx                     # ScreenProfile
      content.jsx                     # ScreenLibrary, ScreenPlayer
      notifications.jsx               # ScreenNotifs
```

`src/main-employee.jsx` shrinks from 2,957 lines to ~10 lines (entry only).

---

## Phase 0 — Backend bring-up on Supabase Cloud

This phase produces a live cloud project so every later phase can call real
APIs. It is mostly CLI + dashboard work — code commits start in Phase 1.

### Task 0.1: Create the Supabase Cloud project

**Files:** none (manual dashboard step).

- [ ] **Step 1: Create the project**

Open https://supabase.com/dashboard and create a new project:
- **Name:** `wellness-plus`
- **Region:** `eu-central-1` (or whichever is closest to the user — Frankfurt by default).
- **Database password:** generate a strong one and save it to a password manager.

- [ ] **Step 2: Capture the project ref + anon key**

Project Settings → API. Copy:
- **Project URL** (looks like `https://xxxxx.supabase.co`)
- **`anon` public key** (the long JWT)
- **Project ref** (the `xxxxx` portion of the URL)

Save these — they are needed in 0.5 and 0.10.

### Task 0.2: Install + log in to the Supabase CLI

**Files:** none.

- [ ] **Step 1: Install the CLI** (skip if already installed)

```bash
brew install supabase/tap/supabase
supabase --version
```
Expected: a version string like `1.x.x`.

- [ ] **Step 2: Log in**

```bash
supabase login
```
Browser will open and authenticate. CLI prints `Finished supabase login.`

### Task 0.3: Link the local repo to the cloud project

**Files:** `.gitignore` (ensure `.supabase/` is ignored — already is via `node_modules`-style entries; add explicit if missing).

- [ ] **Step 1: Link**

```bash
cd /Users/hazzouma/Wellness-
supabase link --project-ref <PROJECT_REF>
```
Provide the database password when prompted. Expected: `Finished supabase link.`

- [ ] **Step 2: Verify link**

```bash
supabase projects list
```
Expected: the linked project shows `●` next to its name.

### Task 0.4: Push migrations to the cloud database

**Files:** none (executes existing files in `supabase/migrations/`).

- [ ] **Step 1: Dry-run inspection**

```bash
supabase db diff --linked
```
Expected: shows the 14 migrations as pending.

- [ ] **Step 2: Push**

```bash
supabase db push
```
Expected output ends with `Finished supabase db push.`

- [ ] **Step 3: Verify all 14 migrations landed**

```bash
supabase db remote commit --dry-run 2>&1 | head -30
```
or via the dashboard SQL editor:

```sql
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
```
Expected: 14 rows starting with `20240101000001` through `20240101000014`.

### Task 0.5: Verify required RPCs and the JWT auth hook exist

**Files:** none (read-only queries against the cloud DB).

- [ ] **Step 1: Confirm RPCs**

In the dashboard SQL editor:

```sql
SELECT proname FROM pg_proc
WHERE proname IN (
  'get_my_checkin_history', 'get_my_progress_stats',
  'custom_access_token_hook'
);
```
Expected: 3 rows.

- [ ] **Step 2: Enable the custom access token hook**

Dashboard → Authentication → Hooks → Custom Access Token Hook.
Set: `public.custom_access_token_hook`. Enable. Save.

This is required: without it, the JWT will *not* include
`app_metadata.company_id`, and every `company_id`-filtered insert from the
client will write `null` and trip RLS.

- [ ] **Step 3: Confirm auth hook is wired**

```sql
SELECT id, hook_table_id, hook_name, hook_function_name FROM auth.hooks;
```
Expected: one row with `hook_function_name = 'custom_access_token_hook'`.

### Task 0.6: Deploy edge functions

**Files:** none (deploys existing `supabase/functions/*`).

- [ ] **Step 1: Deploy `verify-company-code` with public access**

```bash
supabase functions deploy verify-company-code --no-verify-jwt
```
This function runs *before* sign-in, so it must accept anon traffic.

- [ ] **Step 2: Deploy the other 7 edge functions (default JWT verification)**

```bash
supabase functions deploy compute-hr-aggregates
supabase functions deploy delete-account
supabase functions deploy generate-daily-plan
supabase functions deploy generate-insights
supabase functions deploy refresh-leaderboard
supabase functions deploy send-push-notifications
supabase functions deploy update-challenge-activity
```
Each prints `Deployed Function ...`.

- [ ] **Step 3: Confirm all 8 are listed**

```bash
supabase functions list
```
Expected: 8 rows.

### Task 0.7: Apply seed data

**Files:** `supabase/seed.sql` (existing).

- [ ] **Step 1: Get DB connection string**

```bash
supabase projects api-keys --project-ref <PROJECT_REF>
```
Or copy the **connection string** from the dashboard: Project Settings →
Database → Connection string → URI.

- [ ] **Step 2: Apply seed**

```bash
psql "<DB_URL>" -f supabase/seed.sql
```
Expected: a series of `INSERT 0 N` lines, no errors.

- [ ] **Step 3: Verify seeded data**

In dashboard SQL editor:

```sql
SELECT slug, code FROM public.companies;
SELECT count(*) FROM public.content_items WHERE published = true;
SELECT count(*) FROM public.challenges WHERE active = true;
```
Expected: 2 companies (`wellhouse`/`WH-4782`, `nile-group`/`NG-9130`); ≥5
content items; ≥1 active challenge.

### Task 0.8: Configure Supabase Auth

**Files:** none (dashboard config).

- [ ] **Step 1: Enable email OTP**

Dashboard → Authentication → Providers → Email. Toggle:
- **Enable Email Provider:** ON
- **Confirm email:** OFF (OTP-only flow)
- **Secure email change:** ON
- **Mailer OTP expiration:** 600 seconds

- [ ] **Step 2: Set Site URL and redirect allowlist**

Dashboard → Authentication → URL Configuration:
- **Site URL:** `http://localhost:5173`
- **Redirect URLs:** add `http://localhost:5173/*` and `http://localhost:5173/index.html`

- [ ] **Step 3: Disable email-link confirmation in templates**

Dashboard → Authentication → Email Templates → Magic Link. Replace the body
with one that emits the OTP code, e.g.:

```
Your Wellness+ verification code is: {{ .Token }}
```

### Task 0.9: Wire `.env.local`

**Files:** Create `.env.local` (git-ignored).

- [ ] **Step 1: Create `.env.local`**

```bash
cat > .env.local <<'EOF'
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_jwt>
EOF
```
Replace placeholders with values from 0.1 step 2.

- [ ] **Step 2: Confirm `.env.local` is git-ignored**

```bash
git check-ignore .env.local
```
Expected: prints `.env.local`.

### Task 0.10: Sign-in smoke test

**Files:** none.

- [ ] **Step 1: Start dev server**

```bash
npm install
npm run dev
```
Expected: `VITE v6.x.x ready in <Nms>` and a local URL at port 5173.

- [ ] **Step 2: Run the splash flow manually**

Open http://localhost:5173/ in a browser. Use a test email you control.
Enter company code `WH-4782` and the email. Receive an OTP. Enter it.

This is the *current bundle* (no data wiring yet) — you do NOT expect to
land on a logged-in screen. You expect the OTP request to succeed in the
network tab and an email to arrive.

If the OTP arrives, Phase 0 is done — commit nothing yet, move to Phase 1.

If it fails: inspect the network tab. Most common causes:
- Auth hook not enabled (Task 0.5 step 2) — the OTP request itself will
  succeed but the resulting JWT will be missing `app_metadata`.
- Site URL not set (Task 0.8 step 2) — OTP rejected.

---

## Phase 1 — Test infrastructure

Set up Vitest so hook tests can be written in TDD style in Phase 5.

### Task 1.1: Add Vitest + Testing Library as dev dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dev deps**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```
Expected: `package.json` dependencies updated; lockfile updated.

- [ ] **Step 2: Add scripts to `package.json`**

In the `"scripts"` block of `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Add Vitest config inline in `vite.config.js`**

Read `vite.config.js`, then update it to:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main:  resolve(__dirname, 'index.html'),
        hr:    resolve(__dirname, 'hr.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
  },
});
```

- [ ] **Step 4: Create the test setup file**

```bash
mkdir -p test
```

Write `test/setup.js`:

```js
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock import.meta.env for tests
if (!import.meta.env) import.meta.env = {};
import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';

// jsdom doesn't implement matchMedia; some components query it
window.matchMedia = window.matchMedia || (() => ({
  matches: false, addListener: vi.fn(), removeListener: vi.fn(),
}));
```

- [ ] **Step 5: Verify the harness boots**

Write `test/sanity.test.js`:

```js
import { describe, it, expect } from 'vitest';

describe('vitest', () => {
  it('runs', () => { expect(1 + 1).toBe(2); });
});
```

Run: `npm test`
Expected: `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.js test/
git commit -m "chore: add vitest + testing-library for hook tests"
```

---

## Phase 2 — Verbatim frontend extraction

Move every block out of `src/main-employee.jsx` into its target module
without changing any code beyond imports/exports. Keep the build green
after every task.

### Task 2.1: Create the directory tree

**Files:**
- Create: `src/employee/`, `src/employee/state/`, `src/employee/hooks/`, `src/employee/hooks/__tests__/`, `src/employee/screens/`

- [ ] **Step 1: Make directories**

```bash
mkdir -p src/employee/state src/employee/hooks/__tests__ src/employee/screens
```

- [ ] **Step 2: Sanity check**

```bash
ls -la src/employee/
```
Expected: 3 sub-directories listed.

### Task 2.2: Extract `ios-frame.jsx`

**Files:**
- Create: `src/employee/ios-frame.jsx`
- Modify: `src/main-employee.jsx` (remove the extracted block)

The block to move is `// --- ios-frame.jsx ---` from `src/main-employee.jsx`
(lines ~3-341 in the current bundle; cut from the start of that comment
through the end of `IOSKeyboard`).

- [ ] **Step 1: Create `src/employee/ios-frame.jsx`**

The file starts with these two lines, then the verbatim block:

```jsx
import React from 'react';

// (paste the entire ios-frame block from main-employee.jsx here, unchanged)
```

At the *end* of the file, append:

```jsx
export {
  IOSStatusBar, IOSGlassPill, IOSNavBar, IOSListRow, IOSList,
  IOSDevice, IOSKeyboard,
};
```

- [ ] **Step 2: Remove the block from `src/main-employee.jsx`**

Delete the `// --- ios-frame.jsx ---` block from `src/main-employee.jsx`.
At the top of `main-employee.jsx` add:

```jsx
import { IOSDevice, IOSStatusBar, IOSNavBar, IOSGlassPill, IOSList, IOSListRow, IOSKeyboard } from './employee/ios-frame.jsx';
```

- [ ] **Step 3: Verify the build**

```bash
npm run build
```
Expected: build succeeds with no errors. The dev server, if running, also
reloads cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/employee/ios-frame.jsx src/main-employee.jsx
git commit -m "refactor(employee): extract ios-frame.jsx from bundle"
```

### Task 2.3: Extract `design-system.jsx`

**Files:**
- Create: `src/employee/design-system.jsx`
- Modify: `src/main-employee.jsx`

Block to move: from `// --- design-system.jsx ---` through the line before
`// --- i18n.jsx ---` (covers `THEMES`, `typeStyles`, `Icon`,
`AvatarDisplay`, `Button`, `Card`, `Chip`, `SectionLabel`, `WellnessMark`,
`Sparkline`, `Ring`, `Slider`).

- [ ] **Step 1: Create `src/employee/design-system.jsx`**

```jsx
import React from 'react';

// (paste design-system block here, unchanged)

export {
  THEMES, typeStyles, Icon, AvatarDisplay, Button, Card, Chip,
  SectionLabel, WellnessMark, Sparkline, Ring, Slider,
};
```

- [ ] **Step 2: Remove the block from `src/main-employee.jsx`**

In `main-employee.jsx` add the import:

```jsx
import {
  THEMES, typeStyles, Icon, AvatarDisplay, Button, Card, Chip,
  SectionLabel, WellnessMark, Sparkline, Ring, Slider,
} from './employee/design-system.jsx';
```

- [ ] **Step 3: Build and commit**

```bash
npm run build
git add src/employee/design-system.jsx src/main-employee.jsx
git commit -m "refactor(employee): extract design-system.jsx from bundle"
```

### Task 2.4: Extract `i18n.jsx`

**Files:**
- Create: `src/employee/i18n.jsx`
- Modify: `src/main-employee.jsx`

Block: from `// --- i18n.jsx ---` through the line before
`// --- confetti.jsx ---` (covers `STRINGS` and `useT`).

- [ ] **Step 1: Create `src/employee/i18n.jsx`**

```jsx
import React from 'react';

// (paste i18n block here, unchanged)

export { STRINGS, useT };
```

- [ ] **Step 2: Update `main-employee.jsx`**

```jsx
import { STRINGS, useT } from './employee/i18n.jsx';
```

- [ ] **Step 3: Build and commit**

```bash
npm run build
git add src/employee/i18n.jsx src/main-employee.jsx
git commit -m "refactor(employee): extract i18n.jsx from bundle"
```

### Task 2.5: Extract `confetti.jsx`

**Files:**
- Create: `src/employee/confetti.jsx`
- Modify: `src/main-employee.jsx`

- [ ] **Step 1: Create `src/employee/confetti.jsx`**

```jsx
import React, { useState, useEffect } from 'react';

// (paste Confetti block; replace `React.useState` → `useState`,
// `React.useEffect` → `useEffect` if present)

export { Confetti };
```

- [ ] **Step 2: Update `main-employee.jsx`**

```jsx
import { Confetti } from './employee/confetti.jsx';
```

- [ ] **Step 3: Build and commit**

```bash
npm run build
git add src/employee/confetti.jsx src/main-employee.jsx
git commit -m "refactor(employee): extract confetti.jsx from bundle"
```

### Task 2.6: Extract `screens/onboarding.jsx`

**Files:**
- Create: `src/employee/screens/onboarding.jsx`
- Modify: `src/main-employee.jsx`

Block: `// --- screens-onboarding.jsx ---` and everything through the line
before `// --- screens-home.jsx ---`. Includes `ScreenJoin`, `ScreenOTP`,
`ScreenConsent`, `ScreenBaseline`, `ScreenGoals`, `ScreenWelcome`,
`ScreenFrame`, `TopBack`, `ScreenName`.

- [ ] **Step 1: Create `src/employee/screens/onboarding.jsx`**

```jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icon, Button, Card, Chip, SectionLabel, AvatarDisplay, WellnessMark, typeStyles, Slider } from '../design-system.jsx';

// (paste onboarding block; replace any React.useX → named hook imports)

export {
  ScreenJoin, ScreenOTP, ScreenConsent, ScreenBaseline, ScreenGoals,
  ScreenWelcome, ScreenName, ScreenFrame, TopBack,
};
```

- [ ] **Step 2: Update `main-employee.jsx`**

```jsx
import {
  ScreenJoin, ScreenOTP, ScreenConsent, ScreenName, ScreenBaseline,
  ScreenGoals, ScreenWelcome,
} from './employee/screens/onboarding.jsx';
```

- [ ] **Step 3: Build and commit**

```bash
npm run build
git add src/employee/screens/onboarding.jsx src/main-employee.jsx
git commit -m "refactor(employee): extract onboarding screens"
```

### Task 2.7: Extract `screens/home.jsx`

**Files:**
- Create: `src/employee/screens/home.jsx`
- Modify: `src/main-employee.jsx`

Includes `ScreenHome`, `IconBtn`, `LayoutList`, `LayoutStack`, `LayoutAgenda`.

- [ ] **Step 1: Create file**

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Icon, Button, Card, Chip, SectionLabel, WellnessMark, typeStyles, Ring, Sparkline } from '../design-system.jsx';

// (paste home block; replace React.useX → named hooks)

export { ScreenHome };
```

- [ ] **Step 2: Update `main-employee.jsx`**

```jsx
import { ScreenHome } from './employee/screens/home.jsx';
```

- [ ] **Step 3: Build and commit**

```bash
npm run build
git add src/employee/screens/home.jsx src/main-employee.jsx
git commit -m "refactor(employee): extract home screen"
```

### Task 2.8: Extract `screens/checkin.jsx`

**Files:**
- Create: `src/employee/screens/checkin.jsx`
- Modify: `src/main-employee.jsx`

Includes `ScreenCheckIn`, `VarSliders`, `VarEmoji`, `VarCards`.

- [ ] **Step 1: Create file**

```jsx
import React, { useState, useEffect } from 'react';
import { Icon, Button, Card, Chip, typeStyles, Slider } from '../design-system.jsx';

// (paste checkin block; replace React.useX → named hooks)

export { ScreenCheckIn };
```

- [ ] **Step 2: Update `main-employee.jsx`**

```jsx
import { ScreenCheckIn } from './employee/screens/checkin.jsx';
```

- [ ] **Step 3: Build and commit**

```bash
npm run build
git add src/employee/screens/checkin.jsx src/main-employee.jsx
git commit -m "refactor(employee): extract checkin screen"
```

### Task 2.9: Extract `screens/breathe.jsx`

**Files:**
- Create: `src/employee/screens/breathe.jsx`
- Modify: `src/main-employee.jsx`

Includes `ScreenBreathe` only.

- [ ] **Step 1: Create file**

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { Icon, Button, typeStyles } from '../design-system.jsx';

// (paste breathe block; replace React.useX → named hooks)

export { ScreenBreathe };
```

- [ ] **Step 2: Update `main-employee.jsx`**

```jsx
import { ScreenBreathe } from './employee/screens/breathe.jsx';
```

- [ ] **Step 3: Build and commit**

```bash
npm run build
git add src/employee/screens/breathe.jsx src/main-employee.jsx
git commit -m "refactor(employee): extract breathe screen"
```

### Task 2.10: Extract `screens/challenges.jsx`

**Files:**
- Create: `src/employee/screens/challenges.jsx`
- Modify: `src/main-employee.jsx`

Includes `ScreenChallenges`, `LBPodium`, `LBList`, `LBRow`.

- [ ] **Step 1: Create file**

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Icon, Button, Card, Chip, SectionLabel, AvatarDisplay, typeStyles } from '../design-system.jsx';

// (paste challenges block; replace React.useX → named hooks)

export { ScreenChallenges };
```

- [ ] **Step 2: Update `main-employee.jsx`**

```jsx
import { ScreenChallenges } from './employee/screens/challenges.jsx';
```

- [ ] **Step 3: Build and commit**

```bash
npm run build
git add src/employee/screens/challenges.jsx src/main-employee.jsx
git commit -m "refactor(employee): extract challenges screen"
```

### Task 2.11: Extract `screens/progress.jsx` and `screens/profile.jsx`

**Files:**
- Create: `src/employee/screens/progress.jsx`
- Create: `src/employee/screens/profile.jsx`
- Modify: `src/main-employee.jsx`

The bundle had these in one file; the spec splits them.

- [ ] **Step 1: Create `progress.jsx`**

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Icon, Card, SectionLabel, Sparkline, Ring, typeStyles } from '../design-system.jsx';

// (paste ScreenProgress + InsightCard from the bundle)

export { ScreenProgress };
```

- [ ] **Step 2: Create `profile.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import { Icon, Card, Button, AvatarDisplay, typeStyles, WellnessMark } from '../design-system.jsx';

// (paste ScreenProfile + ToggleRow from the bundle)

export { ScreenProfile };
```

- [ ] **Step 3: Update `main-employee.jsx`**

```jsx
import { ScreenProgress } from './employee/screens/progress.jsx';
import { ScreenProfile }  from './employee/screens/profile.jsx';
```

- [ ] **Step 4: Build and commit**

```bash
npm run build
git add src/employee/screens/progress.jsx src/employee/screens/profile.jsx src/main-employee.jsx
git commit -m "refactor(employee): extract progress and profile screens"
```

### Task 2.12: Extract `screens/content.jsx` and `screens/notifications.jsx`

**Files:**
- Create: `src/employee/screens/content.jsx`
- Create: `src/employee/screens/notifications.jsx`
- Modify: `src/main-employee.jsx`

`ScreenLibrary` and `ScreenPlayer` go in `content.jsx`; `ScreenNotifs` goes
in `notifications.jsx`.

- [ ] **Step 1: Create `content.jsx`**

```jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icon, Card, Chip, Button, SectionLabel, typeStyles } from '../design-system.jsx';

// (paste ScreenLibrary and ScreenPlayer)

export { ScreenLibrary, ScreenPlayer };
```

- [ ] **Step 2: Create `notifications.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import { Icon, Card, typeStyles } from '../design-system.jsx';

// (paste ScreenNotifs)

export { ScreenNotifs };
```

- [ ] **Step 3: Update `main-employee.jsx`**

```jsx
import { ScreenLibrary, ScreenPlayer } from './employee/screens/content.jsx';
import { ScreenNotifs } from './employee/screens/notifications.jsx';
```

- [ ] **Step 4: Build and commit**

```bash
npm run build
git add src/employee/screens/content.jsx src/employee/screens/notifications.jsx src/main-employee.jsx
git commit -m "refactor(employee): extract content and notifications screens"
```

---

## Phase 3 — App shell and Tweaks panel

### Task 3.1: Extract Tweaks panel into its own module

**Files:**
- Create: `src/employee/tweaks-panel.jsx`
- Modify: `src/main-employee.jsx`

- [ ] **Step 1: Create file**

Move the `TweaksPanel` function (lines ~2768-2834 in the bundle) into:

```jsx
import React from 'react';
import { Icon, typeStyles } from './design-system.jsx';

// (paste TweaksPanel here)

export { TweaksPanel };
```

- [ ] **Step 2: Update `main-employee.jsx`**

```jsx
import { TweaksPanel } from './employee/tweaks-panel.jsx';
```

Remove the in-bundle `TweaksPanel` definition.

- [ ] **Step 3: Build and commit**

```bash
npm run build
git add src/employee/tweaks-panel.jsx src/main-employee.jsx
git commit -m "refactor(employee): extract tweaks-panel"
```

### Task 3.2: Extract `App.jsx`

**Files:**
- Create: `src/employee/App.jsx`
- Modify: `src/main-employee.jsx`

Move the `TabBar` and `App` functions out, plus the closing `<style>` block.

- [ ] **Step 1: Create file**

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { THEMES, typeStyles, Icon } from './design-system.jsx';
import { useT } from './i18n.jsx';
import { IOSDevice } from './ios-frame.jsx';
import { Confetti } from './confetti.jsx';
import { TweaksPanel } from './tweaks-panel.jsx';

import {
  ScreenJoin, ScreenOTP, ScreenConsent, ScreenName, ScreenBaseline,
  ScreenGoals, ScreenWelcome,
} from './screens/onboarding.jsx';
import { ScreenHome } from './screens/home.jsx';
import { ScreenCheckIn } from './screens/checkin.jsx';
import { ScreenBreathe } from './screens/breathe.jsx';
import { ScreenChallenges } from './screens/challenges.jsx';
import { ScreenProgress } from './screens/progress.jsx';
import { ScreenProfile } from './screens/profile.jsx';
import { ScreenLibrary, ScreenPlayer } from './screens/content.jsx';
import { ScreenNotifs } from './screens/notifications.jsx';

// (paste TabBar and App; replace React.useX with named hook imports)

export default App;
```

- [ ] **Step 2: Trim `src/main-employee.jsx` to entry-only**

Replace the entire contents of `src/main-employee.jsx` with:

```jsx
import React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './employee/App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

- [ ] **Step 3: Build and run dev**

```bash
npm run build
npm run dev
```
Open http://localhost:5173/. Walk every screen via the Tweaks panel
variants. Confirm visual parity with the pre-refactor commit (compare
side-by-side with the live URL on `main` if available).

- [ ] **Step 4: Commit**

```bash
git add src/employee/App.jsx src/main-employee.jsx
git commit -m "refactor(employee): extract App.jsx; main-employee is entry only"
```

### Task 3.3: Gate Tweaks panel behind `?tweaks=1` / DEV

**Files:**
- Modify: `src/employee/App.jsx`

- [ ] **Step 1: Add the gate**

In `App.jsx`, after the Tweaks state hook, add:

```jsx
const tweaksAvailable = import.meta.env.DEV ||
  new URLSearchParams(window.location.search).get('tweaks') === '1';
```

Then wrap the Tweaks render and the toolbar button it depends on:

```jsx
{tweaksAvailable && <TweaksPanel theme={theme} open={tweaksOpen} onClose={...} cfg={cfg} setCfg={setCfg}/>}
```

The button that toggles the panel must also be hidden when
`!tweaksAvailable`.

- [ ] **Step 2: Verify**

Build for production:

```bash
npm run build
npm run preview
```

Open http://localhost:4173/. Confirm there is no Tweaks button visible.
Then open http://localhost:4173/?tweaks=1. Confirm the Tweaks button
returns.

- [ ] **Step 3: Commit**

```bash
git add src/employee/App.jsx
git commit -m "feat(employee): gate Tweaks panel behind ?tweaks=1 in prod"
```

---

## Phase 4 — State contexts

These contexts feed the data hooks and replace the prop-drilling that
exists in the bundle for `theme`, `lang`, `cfg`.

### Task 4.1: AppConfigContext

**Files:**
- Create: `src/employee/state/app-config-context.jsx`
- Modify: `src/employee/App.jsx`

This holds `theme`, `lang`, `density`, and the design-system variant
toggles, and persists them in localStorage.

- [ ] **Step 1: Create the context**

```jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'wellness:app-config';

const DEFAULTS = {
  theme: 'dark',
  lang: 'en',
  density: 'comfortable',
  homeVariant: 'list',
  checkinVariant: 'sliders',
  leaderboardVariant: 'podium',
};

const AppConfigContext = createContext(null);

export function AppConfigProvider({ children }) {
  const [cfg, setCfg] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch { return DEFAULTS; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }
    catch { /* quota or private mode — ignore */ }
  }, [cfg]);

  const value = { cfg, setCfg, patch: (p) => setCfg(c => ({ ...c, ...p })) };
  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfig must be used inside AppConfigProvider');
  return ctx;
}
```

- [ ] **Step 2: Wrap `App` with the provider**

In `src/employee/App.jsx` change:

```jsx
import { AppConfigProvider, useAppConfig } from './state/app-config-context.jsx';

function AppInner() {
  const { cfg, setCfg } = useAppConfig();
  // ... existing App logic, replacing the local cfg useState
}

export default function App() {
  return (
    <AppConfigProvider>
      <AppInner />
    </AppConfigProvider>
  );
}
```

Replace the existing local `useState` for `cfg` with the context value.

- [ ] **Step 3: Verify and commit**

```bash
npm run build
git add src/employee/state/app-config-context.jsx src/employee/App.jsx
git commit -m "feat(employee): AppConfigContext with localStorage persistence"
```

### Task 4.2: AuthContext

**Files:**
- Create: `src/employee/state/auth-context.jsx`
- Modify: `src/lib/supabase.ts`
- Modify: `src/employee/App.jsx`

`AuthContext` exposes `session`, `profile`, `company`, plus
`signInWithCode`, `verifyOtp`, `signOut`, `refreshProfile`. Profile
fetches happen on session change.

- [ ] **Step 1: Add a `getMyCompany()` helper to `supabase.ts`**

Read `src/lib/supabase.ts`. After `getMyProfile`, add:

```ts
export async function getMyCompany() {
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = user?.app_metadata?.company_id as string | undefined;
  if (!companyId) return null;
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, slug, settings')
    .eq('id', companyId)
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Create the context**

`src/employee/state/auth-context.jsx`:

```jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, signInWithOtp, verifyOtp as verifyOtpRaw, signOut as signOutRaw, getMyProfile, getMyCompany, verifyCompanyCode } from '../../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingEmail, setPendingEmail] = useState(null);

  const refreshProfile = useCallback(async () => {
    if (!session) { setProfile(null); setCompany(null); return; }
    try {
      const [p, c] = await Promise.all([getMyProfile(), getMyCompany()]);
      setProfile(p); setCompany(c);
    } catch (e) {
      console.warn('[auth] refreshProfile failed', e);
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  const signInWithCode = useCallback(async (code, email) => {
    const v = await verifyCompanyCode(code, email);
    if (!v.valid) throw new Error(v.error || 'Invalid company code');
    await signInWithOtp(email);
    setPendingEmail(email);
    return v.company;
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

  const value = { session, profile, company, loading, pendingEmail, signInWithCode, verifyOtp, signOut, refreshProfile };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

- [ ] **Step 3: Wrap `App` with `AuthProvider`**

In `src/employee/App.jsx` outer `App`:

```jsx
import { AuthProvider } from './state/auth-context.jsx';

export default function App() {
  return (
    <AppConfigProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </AppConfigProvider>
  );
}
```

- [ ] **Step 4: Verify**

```bash
npm run build
npm run dev
```

Open the app. The Tweaks panel still works (visual parity). Auth is not
yet hooked up to screens, but `useAuth` should not throw.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.ts src/employee/state/auth-context.jsx src/employee/App.jsx
git commit -m "feat(employee): AuthContext with session/profile/company"
```

---

## Phase 5 — Data hooks (TDD)

Each hook gets a Vitest test that mocks `@supabase/supabase-js` and
verifies the hook calls the expected helpers, returns the expected shape,
and cleans up subscriptions.

### Task 5.1: `use-profile`

**Files:**
- Create: `src/employee/hooks/use-profile.js`

Profile is exposed via AuthContext already. This hook is a tiny convenience
wrapper that exposes `update` plus a re-fetch.

- [ ] **Step 1: Create the hook**

```js
import { useAuth } from '../state/auth-context.jsx';
import { updateMyProfile } from '../../lib/supabase';

export function useProfile() {
  const { profile, refreshProfile } = useAuth();
  const update = async (patch) => {
    await updateMyProfile(patch);
    await refreshProfile();
  };
  return { profile, update, refresh: refreshProfile };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/employee/hooks/use-profile.js
git commit -m "feat(employee): use-profile hook"
```

### Task 5.2: `use-checkin` with TDD

**Files:**
- Create: `src/employee/hooks/__tests__/use-checkin.test.js`
- Create: `src/employee/hooks/use-checkin.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  submitCheckin: vi.fn(),
  getCheckinHistory: vi.fn(),
}));

import { submitCheckin, getCheckinHistory } from '../../../lib/supabase';
import { useCheckin } from '../use-checkin';

beforeEach(() => {
  vi.clearAllMocks();
  getCheckinHistory.mockResolvedValue([
    { checked_at: '2026-04-29', sleep: 7, stress: 4, energy: 6, mood: 7 },
  ]);
});

describe('useCheckin', () => {
  it('loads history on mount', async () => {
    const { result } = renderHook(() => useCheckin());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.history).toHaveLength(1);
    expect(getCheckinHistory).toHaveBeenCalledWith(30);
  });

  it('submits a check-in and re-fetches history', async () => {
    submitCheckin.mockResolvedValue({ id: 'x' });
    const { result } = renderHook(() => useCheckin());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.submit({ sleep: 7, stress: 3, energy: 6, mood: 8 });
    });

    expect(submitCheckin).toHaveBeenCalledWith({ sleep: 7, stress: 3, energy: 6, mood: 8 });
    expect(getCheckinHistory).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test src/employee/hooks/__tests__/use-checkin.test.js
```
Expected: `Cannot find module '../use-checkin'` failure.

- [ ] **Step 3: Implement the minimal hook**

```js
import { useState, useEffect, useCallback } from 'react';
import { submitCheckin, getCheckinHistory } from '../../lib/supabase';

export function useCheckin(days = 30) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const rows = await getCheckinHistory(days);
      setHistory(rows);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { refetch(); }, [refetch]);

  const submit = useCallback(async (payload) => {
    const row = await submitCheckin(payload);
    await refetch();
    return row;
  }, [refetch]);

  return { history, loading, error, submit, refetch };
}
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test src/employee/hooks/__tests__/use-checkin.test.js
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/employee/hooks/use-checkin.js src/employee/hooks/__tests__/use-checkin.test.js
git commit -m "feat(employee): use-checkin hook with tests"
```

### Task 5.3: `use-daily-plan` with TDD

**Files:**
- Create: `src/employee/hooks/__tests__/use-daily-plan.test.js`
- Create: `src/employee/hooks/use-daily-plan.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  getTodayPlan: vi.fn(),
  completeAction: vi.fn(),
}));

import { getTodayPlan, completeAction } from '../../../lib/supabase';
import { useDailyPlan } from '../use-daily-plan';

beforeEach(() => {
  vi.clearAllMocks();
  getTodayPlan.mockResolvedValue({
    plan_id: 'p1',
    actions: [{ id: 'a1', kind: 'breathe' }, { id: 'a2', kind: 'walk' }],
    completed_action_ids: ['a1'],
  });
});

describe('useDailyPlan', () => {
  it('loads today plan on mount', async () => {
    const { result } = renderHook(() => useDailyPlan());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.plan.plan_id).toBe('p1');
    expect(result.current.completedIds).toEqual(['a1']);
  });

  it('marks an action complete and updates state', async () => {
    completeAction.mockResolvedValue({});
    const { result } = renderHook(() => useDailyPlan());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.complete('a2'); });

    expect(completeAction).toHaveBeenCalledWith('p1', 'a2');
    expect(result.current.completedIds).toEqual(['a1', 'a2']);
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
npm test src/employee/hooks/__tests__/use-daily-plan.test.js
```

- [ ] **Step 3: Implement**

```js
import { useState, useEffect, useCallback } from 'react';
import { getTodayPlan, completeAction } from '../../lib/supabase';

export function useDailyPlan() {
  const [plan, setPlan] = useState(null);
  const [completedIds, setCompletedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = await getTodayPlan();
      setPlan(p);
      setCompletedIds(p?.completed_action_ids ?? []);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const complete = useCallback(async (actionId) => {
    if (!plan) return;
    await completeAction(plan.plan_id, actionId);
    setCompletedIds(prev => prev.includes(actionId) ? prev : [...prev, actionId]);
  }, [plan]);

  return { plan, completedIds, loading, error, complete, refetch };
}
```

- [ ] **Step 4: Run to pass**

```bash
npm test src/employee/hooks/__tests__/use-daily-plan.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/employee/hooks/use-daily-plan.js src/employee/hooks/__tests__/use-daily-plan.test.js
git commit -m "feat(employee): use-daily-plan hook with tests"
```

### Task 5.4: `use-content` with TDD

**Files:**
- Create: `src/employee/hooks/__tests__/use-content.test.js`
- Create: `src/employee/hooks/use-content.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({
  getContentItems: vi.fn(),
  getFeaturedContent: vi.fn(),
  saveContentProgress: vi.fn(),
}));

import { getContentItems, getFeaturedContent, saveContentProgress } from '../../../lib/supabase';
import { useContent } from '../use-content';

beforeEach(() => {
  vi.clearAllMocks();
  getContentItems.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
  getFeaturedContent.mockResolvedValue([{ id: 'c1', featured: true }]);
});

describe('useContent', () => {
  it('loads list and featured', async () => {
    const { result } = renderHook(() => useContent());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.featured).toHaveLength(1);
  });

  it('persists progress', async () => {
    saveContentProgress.mockResolvedValue();
    const { result } = renderHook(() => useContent());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.saveProgress('c1', 30, false); });
    expect(saveContentProgress).toHaveBeenCalledWith('c1', 30, false);
  });
});
```

- [ ] **Step 2: Implement**

```js
import { useState, useEffect, useCallback } from 'react';
import { getContentItems, getFeaturedContent, saveContentProgress } from '../../lib/supabase';

export function useContent(category) {
  const [items, setItems] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [list, feat] = await Promise.all([
        getContentItems(category),
        getFeaturedContent(),
      ]);
      setItems(list); setFeatured(feat);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [category]);

  useEffect(() => { refetch(); }, [refetch]);

  const saveProgress = useCallback((id, progressS, completed = false) =>
    saveContentProgress(id, progressS, completed), []);

  return { items, featured, loading, error, saveProgress, refetch };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test src/employee/hooks/__tests__/use-content.test.js
git add src/employee/hooks/use-content.js src/employee/hooks/__tests__/use-content.test.js
git commit -m "feat(employee): use-content hook with tests"
```

### Task 5.5: `use-challenges` with TDD (includes realtime)

**Files:**
- Create: `src/employee/hooks/__tests__/use-challenges.test.js`
- Create: `src/employee/hooks/use-challenges.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const unsubscribe = vi.fn();

vi.mock('../../../lib/supabase', () => ({
  getActiveChallenges: vi.fn(),
  joinChallenge: vi.fn(),
  getLeaderboard: vi.fn(),
  subscribeToLeaderboard: vi.fn(() => ({ unsubscribe })),
}));

import {
  getActiveChallenges, joinChallenge, getLeaderboard, subscribeToLeaderboard,
} from '../../../lib/supabase';
import { useChallenges } from '../use-challenges';

beforeEach(() => {
  vi.clearAllMocks();
  getActiveChallenges.mockResolvedValue([{ id: 'ch1', title_en: 'Move' }]);
  getLeaderboard.mockResolvedValue([{ rank: 1, user_id: 'u1' }]);
});

describe('useChallenges', () => {
  it('loads active challenges', async () => {
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.challenges).toHaveLength(1);
  });

  it('subscribes to leaderboard for the active challenge', async () => {
    const { result, unmount } = renderHook(() => useChallenges('ch1'));
    await waitFor(() => expect(getLeaderboard).toHaveBeenCalledWith('ch1'));
    expect(subscribeToLeaderboard).toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('joins a challenge', async () => {
    joinChallenge.mockResolvedValue({});
    const { result } = renderHook(() => useChallenges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.join('ch1'); });
    expect(joinChallenge).toHaveBeenCalledWith('ch1');
  });
});
```

- [ ] **Step 2: Implement**

```js
import { useState, useEffect, useCallback } from 'react';
import {
  getActiveChallenges, joinChallenge, getLeaderboard, subscribeToLeaderboard,
} from '../../lib/supabase';

export function useChallenges(activeChallengeId = null) {
  const [challenges, setChallenges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await getActiveChallenges();
      setChallenges(list);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!activeChallengeId) return;
    let cancelled = false;
    getLeaderboard(activeChallengeId).then(rows => { if (!cancelled) setLeaderboard(rows); });
    const sub = subscribeToLeaderboard(activeChallengeId, () => {
      getLeaderboard(activeChallengeId).then(rows => { if (!cancelled) setLeaderboard(rows); });
    });
    return () => { cancelled = true; sub?.unsubscribe?.(); };
  }, [activeChallengeId]);

  const join = useCallback(async (id) => {
    await joinChallenge(id);
    await refetch();
  }, [refetch]);

  return { challenges, leaderboard, loading, error, join, refetch };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test src/employee/hooks/__tests__/use-challenges.test.js
git add src/employee/hooks/use-challenges.js src/employee/hooks/__tests__/use-challenges.test.js
git commit -m "feat(employee): use-challenges hook with realtime tests"
```

### Task 5.6: `use-progress` with TDD

**Files:**
- Create: `src/employee/hooks/__tests__/use-progress.test.js`
- Create: `src/employee/hooks/use-progress.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/supabase', () => ({ getProgressStats: vi.fn() }));

import { getProgressStats } from '../../../lib/supabase';
import { useProgress } from '../use-progress';

beforeEach(() => {
  vi.clearAllMocks();
  getProgressStats.mockResolvedValue({
    avg_sleep: 6.8, avg_stress: 4.2, avg_energy: 6.5, avg_mood: 7.1,
    total_checkins: 18, streak_current: 3, streak_best: 12,
    history: [],
  });
});

describe('useProgress', () => {
  it('loads progress stats on mount', async () => {
    const { result } = renderHook(() => useProgress());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats.streak_current).toBe(3);
  });
});
```

- [ ] **Step 2: Implement**

```js
import { useState, useEffect, useCallback } from 'react';
import { getProgressStats } from '../../lib/supabase';

export function useProgress() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setStats(await getProgressStats()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { stats, loading, error, refetch };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test src/employee/hooks/__tests__/use-progress.test.js
git add src/employee/hooks/use-progress.js src/employee/hooks/__tests__/use-progress.test.js
git commit -m "feat(employee): use-progress hook with tests"
```

### Task 5.7: `use-notifications` with TDD (realtime)

**Files:**
- Create: `src/employee/hooks/__tests__/use-notifications.test.js`
- Create: `src/employee/hooks/use-notifications.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const unsubscribe = vi.fn();
vi.mock('../../../lib/supabase', () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  subscribeToNotifications: vi.fn(() => ({ unsubscribe })),
}));

import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  subscribeToNotifications,
} from '../../../lib/supabase';
import { useNotifications } from '../use-notifications';

beforeEach(() => {
  vi.clearAllMocks();
  getNotifications.mockResolvedValue([
    { id: 'n1', read: false }, { id: 'n2', read: true },
  ]);
});

describe('useNotifications', () => {
  it('loads notifications and computes unread count', async () => {
    const { result } = renderHook(() => useNotifications('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.list).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
  });

  it('subscribes when userId is provided and unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useNotifications('user-1'));
    await waitFor(() => expect(subscribeToNotifications).toHaveBeenCalled());
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('marks one as read', async () => {
    markNotificationRead.mockResolvedValue();
    const { result } = renderHook(() => useNotifications('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.markRead('n1'); });
    expect(markNotificationRead).toHaveBeenCalledWith('n1');
  });
});
```

- [ ] **Step 2: Implement**

```js
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  subscribeToNotifications,
} from '../../lib/supabase';

export function useNotifications(userId) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setList(await getNotifications()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!userId) return;
    const sub = subscribeToNotifications(userId, () => refetch());
    return () => sub?.unsubscribe?.();
  }, [userId, refetch]);

  const unreadCount = useMemo(
    () => list.filter(n => !n.read).length, [list]
  );

  const markRead = useCallback(async (id) => {
    await markNotificationRead(id);
    setList(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setList(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  return { list, loading, error, unreadCount, markRead, markAllRead, refetch };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test src/employee/hooks/__tests__/use-notifications.test.js
git add src/employee/hooks/use-notifications.js src/employee/hooks/__tests__/use-notifications.test.js
git commit -m "feat(employee): use-notifications hook with realtime tests"
```

### Task 5.8: `use-insights`

**Files:**
- Create: `src/employee/hooks/use-insights.js`

- [ ] **Step 1: Implement**

```js
import { useState, useEffect, useCallback } from 'react';
import { getInsights } from '../../lib/supabase';

export function useInsights() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setInsights(await getInsights()); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { insights, loading, error, refetch };
}
```

- [ ] **Step 2: Run all tests + commit**

```bash
npm test
git add src/employee/hooks/use-insights.js
git commit -m "feat(employee): use-insights hook"
```

---

## Phase 6 — Wire screens to hooks

Each screen task replaces hardcoded data with hook calls and wires
`onSubmit`/`onClick` to the appropriate mutation. Manual smoke verification
after each.

### Task 6.1: Wire onboarding flow

**Files:**
- Modify: `src/employee/screens/onboarding.jsx`
- Modify: `src/employee/App.jsx`

- [ ] **Step 1: Wire `ScreenJoin` to `signInWithCode`**

In `screens/onboarding.jsx`, change `ScreenJoin` to import `useAuth`:

```jsx
import { useAuth } from '../state/auth-context.jsx';
```

Inside `ScreenJoin` replace the existing `onNext` handler with:

```jsx
const { signInWithCode } = useAuth();
const [busy, setBusy] = useState(false);
const [err, setErr] = useState(null);

const handleSubmit = async () => {
  setErr(null); setBusy(true);
  try {
    await signInWithCode(code, email);
    onNext();
  } catch (e) { setErr(e.message); }
  finally { setBusy(false); }
};
```

Disable the submit button when `busy`. Render `err` under the form.

- [ ] **Step 2: Wire `ScreenOTP` to `verifyOtp`**

```jsx
const { verifyOtp } = useAuth();
const handleVerify = async (token) => {
  await verifyOtp(token);
  onNext();
};
```

- [ ] **Step 3: Wire `ScreenName` / `ScreenBaseline` / `ScreenGoals` to `useProfile`**

In each screen, on advance:

```jsx
import { useProfile } from '../hooks/use-profile.js';
const { update } = useProfile();
// in handler:
await update({ display_name: name });    // ScreenName
await update({ baseline_sleep, baseline_stress, baseline_energy, baseline_mood });  // ScreenBaseline
await update({ goals: chosenGoals });    // ScreenGoals
```

- [ ] **Step 4: On `ScreenWelcome` set `onboarded_at`**

```jsx
const { update } = useProfile();
await update({ onboarded_at: new Date().toISOString() });
```

- [ ] **Step 5: In `App.jsx`, branch on session + onboarded**

Replace the existing onboarding state machine with:

```jsx
const { session, profile, loading } = useAuth();

if (loading) return <Splash/>;
if (!session) return <OnboardingFlow startAt="join"/>;
if (!profile?.onboarded_at) return <OnboardingFlow startAt="consent"/>;
return <MainApp/>;
```

`Splash` is the existing intro splash screen. `OnboardingFlow` wraps the
existing onboarding screens with a `startAt` prop that selects the
starting step.

- [ ] **Step 6: Manual smoke**

```bash
npm run dev
```
Test: with a fresh email, walk Join → OTP → Consent → Name → Baseline →
Goals → Welcome → Home. Reload — Home loads directly.

- [ ] **Step 7: Commit**

```bash
git add src/employee/screens/onboarding.jsx src/employee/App.jsx
git commit -m "feat(employee): wire onboarding flow to AuthContext + profile"
```

### Task 6.2: Wire `ScreenHome`

**Files:**
- Modify: `src/employee/screens/home.jsx`

- [ ] **Step 1: Replace hardcoded actions with hook data**

```jsx
import { useDailyPlan } from '../hooks/use-daily-plan.js';
// ...
const { plan, completedIds, loading, complete } = useDailyPlan();
const actions = plan?.actions ?? [];
```

Render an empty/loading state when `loading || !plan`.

Pass `completedIds` into the layout components, and wire each action card's
onClick to `complete(action.id)`.

- [ ] **Step 2: Manual smoke** — load `/`, verify the home plan reflects DB
state. Mark an action complete; reload; the action stays complete.

- [ ] **Step 3: Commit**

```bash
git add src/employee/screens/home.jsx
git commit -m "feat(employee): wire home screen to daily-plan hook"
```

### Task 6.3: Wire `ScreenCheckIn`

**Files:**
- Modify: `src/employee/screens/checkin.jsx`

- [ ] **Step 1: Replace local commit with `submit`**

```jsx
import { useCheckin } from '../hooks/use-checkin.js';
// ...
const { submit } = useCheckin();
const handleSubmit = async () => {
  await submit({
    sleep: vals.sleep, stress: vals.stress,
    energy: vals.energy, mood: vals.mood,
    note: vals.note ?? '',
    variant,
  });
  go('home');
};
```

- [ ] **Step 2: Manual smoke** — submit a check-in; navigate to Progress;
verify it appears in the history.

- [ ] **Step 3: Commit**

```bash
git add src/employee/screens/checkin.jsx
git commit -m "feat(employee): wire checkin screen to use-checkin"
```

### Task 6.4: Wire `ScreenChallenges`

**Files:**
- Modify: `src/employee/screens/challenges.jsx`

- [ ] **Step 1: Replace mock data with `useChallenges`**

```jsx
import { useChallenges } from '../hooks/use-challenges.js';
// ...
const [activeId, setActiveId] = useState(null);
const { challenges, leaderboard, join, loading } = useChallenges(activeId);

// when user picks a challenge:
setActiveId(c.id);

// when user joins:
await join(c.id);
```

- [ ] **Step 2: Manual smoke** — open challenges; pick the seeded challenge;
join; verify the leaderboard list renders. In another tab, insert a
`challenge_activities` row; verify the leaderboard updates without reload.

- [ ] **Step 3: Commit**

```bash
git add src/employee/screens/challenges.jsx
git commit -m "feat(employee): wire challenges to use-challenges + realtime leaderboard"
```

### Task 6.5: Wire `ScreenProgress`

**Files:**
- Modify: `src/employee/screens/progress.jsx`

- [ ] **Step 1: Use `use-progress` and `use-insights`**

```jsx
import { useProgress } from '../hooks/use-progress.js';
import { useInsights } from '../hooks/use-insights.js';
// ...
const { stats, loading } = useProgress();
const { insights } = useInsights();

if (loading || !stats) return <ProgressLoading theme={theme}/>;
// pass stats.history into the chart, stats.streak_current into the streak card, etc.
// pass insights[] into the InsightCard list.
```

- [ ] **Step 2: Manual smoke** — submit a couple of check-ins; reload
Progress; verify averages and history sparkline reflect them.

- [ ] **Step 3: Commit**

```bash
git add src/employee/screens/progress.jsx
git commit -m "feat(employee): wire progress to use-progress + use-insights"
```

### Task 6.6: Wire `ScreenProfile`

**Files:**
- Modify: `src/employee/screens/profile.jsx`

- [ ] **Step 1: Replace local state with `useAuth` + `useProfile`**

```jsx
import { useAuth } from '../state/auth-context.jsx';
import { useProfile } from '../hooks/use-profile.js';
// ...
const { signOut, company } = useAuth();
const { profile, update } = useProfile();
```

Use `profile.display_name`, `profile.avatar_kind`, `company.name`. Wire
ToggleRows to `update({ ... })`. Sign-out button calls `signOut`.

- [ ] **Step 2: Manual smoke** — flip a profile toggle; reload; persisted.
Sign out; sign back in; profile shows the same values.

- [ ] **Step 3: Commit**

```bash
git add src/employee/screens/profile.jsx
git commit -m "feat(employee): wire profile to AuthContext + use-profile"
```

### Task 6.7: Wire `ScreenLibrary` and `ScreenPlayer`

**Files:**
- Modify: `src/employee/screens/content.jsx`

- [ ] **Step 1: Use `useContent` in Library**

```jsx
import { useContent } from '../hooks/use-content.js';
// ...
const [category, setCategory] = useState(null);
const { items, featured, loading } = useContent(category);
```

Render Featured strip from `featured`; main grid from `items`. Filter Chip
sets `category`.

- [ ] **Step 2: Use `useContent.saveProgress` in Player**

When the player reports time updates:

```jsx
const { saveProgress } = useContent();
// every ~5s during playback:
saveProgress(item.id, currentSec, false);
// on finish:
saveProgress(item.id, durationSec, true);
```

Use a `setInterval` ref to throttle the calls.

- [ ] **Step 3: Manual smoke** — open Library; play a featured audio; close
mid-way; reopen; player resumes near where you left off.

- [ ] **Step 4: Commit**

```bash
git add src/employee/screens/content.jsx
git commit -m "feat(employee): wire content library + player to use-content"
```

### Task 6.8: Wire `ScreenNotifs` + bell badge

**Files:**
- Modify: `src/employee/screens/notifications.jsx`
- Modify: `src/employee/App.jsx`

- [ ] **Step 1: Use `useNotifications` in `ScreenNotifs`**

```jsx
import { useAuth } from '../state/auth-context.jsx';
import { useNotifications } from '../hooks/use-notifications.js';
// ...
const { session } = useAuth();
const { list, markRead, markAllRead, unreadCount } = useNotifications(session?.user?.id);
```

Wire row clicks to `markRead(id)` and the toolbar action to `markAllRead()`.

- [ ] **Step 2: Surface `unreadCount` in the App tab bar**

Pass it down through App so the home tab (or a dedicated bell icon) shows
the badge.

- [ ] **Step 3: Manual smoke** — sign in; in dashboard SQL editor:

```sql
INSERT INTO notifications (user_id, kind, title_en, body_en)
SELECT id, 'info', 'Test', 'A test notification' FROM auth.users WHERE email = '<your test email>' LIMIT 1;
```

Verify the bell badge increments without reload.

- [ ] **Step 4: Commit**

```bash
git add src/employee/screens/notifications.jsx src/employee/App.jsx
git commit -m "feat(employee): wire notifications screen + realtime badge"
```

### Task 6.9: Add a Splash + access-denied screen

**Files:**
- Create: `src/employee/screens/splash.jsx`
- Modify: `src/employee/App.jsx`

A small intro shown during `auth.loading` to avoid flicker.

- [ ] **Step 1: Create file**

```jsx
import React from 'react';
import { WellnessMark } from '../design-system.jsx';

export function Splash({ theme }) {
  return (
    <div style={{
      minHeight: '100vh', background: theme.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <WellnessMark theme={theme} size={48}/>
    </div>
  );
}
```

- [ ] **Step 2: Use in `App.jsx`**

```jsx
import { Splash } from './screens/splash.jsx';
// ...
if (loading) return <Splash theme={theme}/>;
```

- [ ] **Step 3: Commit**

```bash
git add src/employee/screens/splash.jsx src/employee/App.jsx
git commit -m "feat(employee): splash during auth load"
```

---

## Phase 7 — Final verification

Walk every step from the spec's verification section.

### Task 7.1: Run the full verification suite

**Files:** none.

- [ ] **Step 1: Production build**

```bash
npm run build
```
Expected: three HTML entries (`index.html`, `hr.html`, `admin.html`) and
their bundles, no transform errors.

- [ ] **Step 2: All hook tests pass**

```bash
npm test
```
Expected: all spec'd suites pass.

- [ ] **Step 3: Walk the 11 spec verification steps**

Run `npm run dev` and execute steps 1–11 from
[the spec verification section](../specs/2026-04-30-employee-app-design.md#verification).
For each, mark it green or list the failure.

The 11 steps are:
1. Sign-up with `WH-4782` + test email → OTP → land on Consent.
2. Onboarding completes; reload skips onboarding.
3. Submit check-in → reload → visible in Progress; resubmit upserts.
4. Open Home → mark action complete → reload → stays complete.
5. Library → play audio → close → reopen → progress restored.
6. Join challenge → leaderboard renders → SQL insert → realtime update.
7. SQL insert notification → bell badge increments without reload.
8. Switch to AR via Tweaks → entire app flips RTL; font swaps.
9. Sign out → land on Splash → sign in → no re-onboarding.
10. RLS check: with user A's anon JWT, select user B's check-ins returns 0.
11. Build clean, no console warnings.

- [ ] **Step 4: RLS smoke via dashboard SQL**

In the dashboard SQL editor with a different user's JWT (toggle "Run as a
specific user"):

```sql
SELECT count(*) FROM checkins;
```
Expected: count of *only that user's* check-ins.

- [ ] **Step 5: If everything passes, mark the spec complete**

```bash
git tag employee-app-v1
git push --tags
```
(Do not push to `main` without explicit user authorization. Branch + PR
flow per repo convention.)

### Task 7.2: Capture a follow-ups note

**Files:**
- Create: `docs/superpowers/follow-ups/2026-04-30-employee-followups.md`

- [ ] **Step 1: Note anything you found during verification that wasn't
  worth fixing inline** — flaky behaviour, design polish, missing edge
  cases. This becomes input for the HR sub-project follow-up.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/follow-ups/
git commit -m "docs: capture employee app follow-ups"
```

---

## Self-review

**1. Spec coverage:**
- Goal 1 (working employee app on cloud) — Phases 0 + 6.
- Goal 2 (per-screen module tree) — Phase 2.
- Goal 3 (RLS only, no service-role on client) — verified in Task 0.5
  (auth hook), Task 7.1 step 4 (RLS smoke).
- Goal 4 (bilingual / RTL preserved) — Phase 2 keeps `i18n.jsx` intact;
  Task 7.1 step 3 verifies AR.
- Goal 5 (iOS-frame chrome preserved) — Phase 2 keeps `ios-frame.jsx`
  verbatim.
- Goal 6 (visual parity) — Task 3.2 step 3 explicit visual check.
- Backend bring-up phase 0 — covered by 0.1–0.10.
- Verification 1–11 — covered by Task 7.1 step 3.
- Risks → JWT auth-hook silence: Task 0.5 enables it explicitly.
- Risks → `verify-company-code` deploy ordering: Task 0.6 step 1.
- Risks → hook import gotcha: each Phase-2 task includes the named hook
  imports template.
- Risks → visual regression during refactor: Task 3.2 step 3.

**2. Placeholder scan:** No "TBD"/"TODO" outside the spec's open
questions. Each step has the actual code or command. The verbatim-paste
instruction in Phase 2 references concrete blocks by their `// --- name ---`
comments and is self-contained.

**3. Type/name consistency:**
- `submitCheckin`, `getCheckinHistory`, `getProgressStats`,
  `getActiveChallenges`, `joinChallenge`, `getLeaderboard`,
  `subscribeToLeaderboard`, `getNotifications`, `markNotificationRead`,
  `markAllNotificationsRead`, `subscribeToNotifications`, `getInsights`,
  `getTodayPlan`, `completeAction`, `saveContentProgress`,
  `getContentItems`, `getFeaturedContent`, `verifyCompanyCode`,
  `signInWithOtp`, `verifyOtp`, `signOut`, `getMyProfile`,
  `updateMyProfile`, `getMyCompany` — all match the export names in
  `src/lib/supabase.ts` (`getMyCompany` is a new helper added in Task
  4.2 step 1).
- Hook names: `useCheckin`, `useDailyPlan`, `useContent`, `useChallenges`,
  `useProgress`, `useInsights`, `useNotifications`, `useProfile`,
  `useAuth`, `useAppConfig` — used identically across tests, hook files,
  and screen wires.
- Variant names (`homeVariant`, `checkinVariant`, `leaderboardVariant`)
  match the cfg keys in the existing bundle.

No issues found.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-30-employee-app-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good for a long plan with isolated tasks.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
