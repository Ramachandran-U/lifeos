# E2E tests

Two auth paths exist. Pick the right one for what you're testing.

## Path A — seeded localStorage (fast, default)

Used by: `smoke`, `smoke-mobile`, `chromium` (career-strategy, voice-assistant,
routine-block-complete, notifications-prefs).

The [helpers.ts](./helpers.ts) `seedAuthedUser` writes a fake user, one routine
block, and two days of domain history into `localStorage` via `addInitScript`,
then loads the app. The app's session guard sees the seeded user and skips the
real sign-in form entirely. No Supabase round-trip.

```bash
npm run smoke:local       # 24 routes + 6 navs, desktop viewport
npm run smoke:mobile      # same routes, iPhone 13 viewport
npm run e2e               # career + voice + routine + notifications
```

## Path B — real sign-in (imitates a manual tester)

Used by: `authenticated` project (auth-routing, auth-signout, onboarding-fresh,
engine-authed, sync-cross-device — `ambient.spec.ts` moved to the self-seeding
`chromium` project at the Ink + Signal rewrite). Goes through the real
`/sign-in` form against a real Supabase user.

This is the path to use when verifying that the auth flow itself works, or
when seeded `localStorage` would mask a regression (e.g. session-token
expiry, OAuth redirect handling, Supabase row-level security).

### One-time setup

1. **Create the test user in Supabase.** You need `SUPABASE_SERVICE_ROLE_KEY`
   from the Supabase dashboard (Settings → API → service_role, **never commit
   this**).

   ```bash
   export SUPABASE_SERVICE_ROLE_KEY=eyJ…
   export EXPO_PUBLIC_SUPABASE_URL=https://izojsgzlaehodwlqwyvf.supabase.co
   npm run e2e:create-test-user
   ```

   This creates `lifeos-e2e-test@example.com` with a strong password and
   auto-confirms the email. Idempotent — re-running it tells you the user
   already exists.

2. **Save credentials locally.** Copy [.env.test.example](../.env.test.example)
   to `.env.test` and paste the credentials the script printed. The Playwright
   config auto-loads this file at startup — no `dotenv-cli` needed.

   ```bash
   cp .env.test.example .env.test
   # edit PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD
   ```

3. **Run.** [auth.setup.ts](./auth.setup.ts) signs in once, saves the
   storage state to `.auth/user.json`, and every authenticated spec reuses it.

   ```bash
   npm run e2e:auth
   ```

### Running specs that need mocked AI (onboarding, fresh-user)

Some authenticated specs walk through screens that fire AI calls
([`onboarding-fresh.spec.ts`](./onboarding-fresh.spec.ts) walks day1-vision
→ career → routine). These need the mock branch baked into the bundle so
the AI calls return deterministic data.

CI already sets `EXPO_PUBLIC_USE_AI_MOCK=true`. For a local run against a
built bundle:

```bash
# 1. Temporarily flip the flag in .env
#    EXPO_PUBLIC_USE_AI_MOCK=true
#    USE_AI_MOCK=true

# 2. Clear Metro's persistent cache (it survives rm -rf dist/!)
#    Metro caches in OS temp keyed on input hashes; without --clear or a
#    cache wipe, expo export will re-serve the previous bundle bytes.
rm -rf $TEMP/metro-cache $TEMP/metro-file-map-*
npx expo export --platform web --clear

# 3. Serve and run
npx serve dist -l 8090 --single &
SMOKE_BASE_URL=http://localhost:8090 npm run e2e:auth

# 4. Restore .env when done (EXPO_PUBLIC_USE_AI_MOCK=false)
```

The onboarding spec also needs `SUPABASE_SERVICE_ROLE_KEY` set in your
shell — it creates an ephemeral Supabase user per run and deletes it on
teardown (see [`ephemeralUser.ts`](./ephemeralUser.ts)).

### Pointing at a deploy preview

Both paths honour `SMOKE_BASE_URL`:

```bash
SMOKE_BASE_URL=https://<hash>.lifeos-6r5-eqa.pages.dev npm run e2e:auth
```

## CI

[../.github/workflows/e2e.yml](../.github/workflows/e2e.yml) runs all three
projects against the freshly-built web export, with `EXPO_PUBLIC_USE_AI_MOCK=true`
so no AI budget is spent.

| Step | Project | Auth | Required? |
|---|---|---|---|
| `chromium` | career, voice, routine, notifications, health/goals logging, CUJs, **plus the Ink + Signal suites**: ambient, ink-structural, cold-start, today-answer-first, module-hierarchy | seeded localStorage | ✓ blocking |
| `smoke` | route walker (routes.json — markers are testIDs/stable labels, not copy strings) | seeded localStorage | ✓ blocking |
| `authenticated` | auth-routing/signout, onboarding-fresh, engine-authed, sync-cross-device | real Supabase sign-in | non-blocking (`continue-on-error: true`) |

### Enabling the authenticated step

The authenticated job is gated on three repo secrets being present. Without
them the step skips cleanly (so forks still pass CI). Add them in repo
**Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Where to find it | Value |
|---|---|---|
| `PLAYWRIGHT_TEST_EMAIL` | output of `npm run e2e:create-test-user` | `lifeos-e2e-test@example.com` |
| `PLAYWRIGHT_TEST_PASSWORD` | output of `npm run e2e:create-test-user` | `LifeOS-E2E-Test-2026!` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API → `anon` key | starts `eyJ…` |

The anon key is safe to expose by design (it ships in the production web
bundle). The service-role key is **not** needed in CI — it's only used once
locally by `npm run e2e:create-test-user`.

After adding the secrets, the next CI run will execute the authenticated
step. It runs after the seeded steps and is `continue-on-error: true` for
the first ~50 runs, so a Supabase blip won't block merges. Once it's been
stable, drop the `continue-on-error` line in
[.github/workflows/e2e.yml](../.github/workflows/e2e.yml) to make it
required.

## Visual regression

[`visual-regression.spec.ts`](./visual-regression.spec.ts) (project `visual`)
guards the Ink + Signal progress bars (solid domain hue on `c.track`) and the
recomposed goals/social screens against committed screenshot baselines
(re-recorded at the W1 ink cutover, the W2 module headers, and the V1 social
tree). It seeds **filled** data via [`seedVisualRich`](./helpers.ts) — the
test-suite mirror of the run-lifeos driver's `--rich` flag — so the bars render
at fixed proportions (goals Career 75 % / Health 40 %, social 60 %). The seed
also forces reduce-motion and suppresses install chrome so each capture is
deterministic. Targets `/goals` and `/social` (time-stable module headers — no
time-of-day greeting like Today's).

```bash
# 1. Build + serve a current bundle (the project reads SMOKE_BASE_URL).
npx expo export --platform web --output-dir tmp/dist-verify
npx serve tmp/dist-verify -l 8090 --single &

# 2. Compare against baselines …
SMOKE_BASE_URL=http://localhost:8090 npm run visual
# … or (re)generate them:
SMOKE_BASE_URL=http://localhost:8090 npm run visual:update
```

Baselines live in `e2e/visual-regression.spec.ts-snapshots/` and are
**platform-suffixed** (e.g. `-visual-win32.png`). **This project is intentionally
NOT in CI** — Playwright baselines are pixel-specific to the OS/browser that
generated them, and this repo's CI is Linux. Wiring it into the blocking CI
projects would require generating Linux baselines (run `visual:update` inside the
Playwright Linux container / a CI job) and committing the `-linux` variants; until
then it's a local pre-merge check. The committed baselines here were generated on
win32.
