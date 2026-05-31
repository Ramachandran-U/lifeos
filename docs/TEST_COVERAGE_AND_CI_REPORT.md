# Test Coverage & CI Report — autonomous session (night of 2026-05-30)

> **Historical snapshot (closed 2026-05-31).** The CI fixes proposed in this report have since LANDED on `lifeosv1` — the E2E auth specs are now scoped to the `authenticated` Playwright project (see `playwright.config.ts`), and the node suite has grown to ~688 tests. Kept as a record of that session; not a live action list.

Branch: `test/coverage-ci-followup` (off `lifeosv1`). _(At the time of writing: nothing pushed/merged — now superseded, see banner above.)_

---

## TL;DR
- **Added 31 unit tests across 3 files, all green.** Full suite now **623 passing** (was 615).
- **CI is red — but it's a test-harness/config problem, not a product bug.** The E2E
  workflow runs auth-dependent Playwright specs *without* a logged-in session, and a
  required secret isn't set. Detailed fix plan + ELI5 below. The **AI Evals** workflow is healthy.
- **Biggest structural gap:** no React Native *component* can be unit-tested today (jest is
  node-only and ignores `src/components/`), so the design-Wave UI is only smoke-mounted, not
  behaviour-tested. Fixing that needs a small infra add (jest-expo) — recommended, not done.

---

# Part 1 — Test coverage

## 1a. What I added this session (verified green)

| File | Tests | Why it matters |
|---|---|---|
| `src/utils/__tests__/currency.test.ts` | 20 | **P0.** `currency.ts` powers every money figure in Finance + onboarding day-7 and had **zero** tests. Pins lakh/crore + millions formatting boundaries, `parseMoneyInput` (commas/symbols/negatives), income-bracket labels. |
| `src/finance/gmail/__tests__/fetcher.test.ts` | 8 | **P0.** Bank-email ingestion (real user money data). Covers pagination + dedup + `maxResults` cap, non-ok error, header parsing, base64url + HTML body extraction, and skipping failed fetches. Mocks `fetch` + `./oauth`. |
| `src/theme/__tests__/domainIcons.test.ts` | 3 | **P1.** Guards the canonical icon map so the radar / blocks / headers / hub / chips never desync (every domain mapped; `MODULE_ICONS ⊇ DOMAIN_ICONS` + rest/work/meal). lucide is scope-mocked (it pulls `react-native-svg`, which can't load in node jest). |

All run in the existing jest harness with **no infra changes**. `npx jest` → 78 suites / 623 tests pass.

## 1b. Coverage map (from the audit)
- **Well covered already:** the AI/cognition work from the other sessions — what-next agent,
  agent runtime + tool registry, propose/confirm write tools, memory/consolidation/RAG, goal
  rebalance, variant policy, cognition detectors, suggestion-outcome measurement, Gemini
  function-calling (worker), explore/expedition/spark, finance email *parsers*.
- **Now covered (this session):** currency utils, gmail *fetcher*, domain-icon map.
- **Still uncovered — recommended next (NOT done, needs decisions/infra):**

| Gap | Why it's not done yet | Recommendation |
|---|---|---|
| `Button`, `EmptyState`, `DomainGlyph`, `Card`/`GlassCard` **render behaviour** | jest runs in `node` and `testPathIgnorePatterns` excludes `src/components/`. No RN render harness exists. | **Highest-leverage infra add:** a second jest project using `jest-expo` + `@testing-library/react-native`. Then test: Button loading/disabled/icon, EmptyState CTA, etc. (Installing this blind risks destabilising the green node suite, so I left it for a supervised step.) |
| `welcome-intent` two-path fork + chips (e2e) | Needs the Playwright suite, which is currently **red** (Part 2). Writing specs into a broken, unverifiable suite adds noise. | Add `e2e/welcome-intent.spec.ts` (authenticated project) **after** the CI fix lands. Skeleton in Part 3. |
| Onboarding finance interaction (₹ presets, generate) | same (e2e suite red) | Extend `onboarding-fresh.spec.ts` after CI fix. |
| Priority Phase C "what changed?" capture/persistence | Handler is tested; the capture path isn't. Lower risk. | Add a case to `priorityChangeHandler.test.ts`. |

---

# Part 2 — CI failures: what failed, and the impact

## 2a. The shape of it
Two workflows: **AI Evals** (`evals.yml`) and **E2E Tests** (`e2e.yml`).
- **AI Evals: green.** No action.
- **E2E Tests: red on every push since 2026-05-29.** It went red at the commit that
  *"expanded real-auth e2e coverage"* (PR #49) and has failed every run since. This is
  **systemic, not flaky** — the same misconfiguration fails each time; only *which* test trips
  first varies (which is why it can superficially look flaky).

The failing step is always `npx playwright test --project=chromium`: 8 tests run, **4 fail**.

## 2b. The root cause (one sentence)
`playwright.config.ts`'s **`chromium` project picks up auth-dependent specs** (`auth-routing`,
`auth-signout`, `onboarding-fresh`) **without a logged-in session**, and the secret those specs
need (`SUPABASE_SERVICE_ROLE_KEY`) **isn't configured in CI**. Those specs are *also* (correctly)
listed under the `authenticated` project — running them under `chromium` too is the bug.

## 2c. Each failure — technical + plain English + ELI5

### Failure A — "Ephemeral users require SUPABASE_SERVICE_ROLE_KEY…"
- **Tests:** `auth-routing.spec.ts` (fresh user → day1-vision), `onboarding-fresh.spec.ts`.
- **Technical:** `e2e/ephemeralUser.ts:35` throws because `SUPABASE_SERVICE_ROLE_KEY` is unset in
  CI (only `…ANON_KEY` + test email/password are configured). These specs create a throwaway test
  account on the fly and can't.
- **Normal terms:** Two tests need to create a brand-new temporary user account to test the
  first-time experience. The secret key that lets them create accounts was never added to GitHub,
  so they fail instantly.
- **ELI5:** The robot tester needs a key to make a pretend new account. Nobody gave it the key, so
  it can't get in the door and gives up.
- **Severity: BLOCKING** (turns the build red). It's a *setup* problem, not a broken feature.

### Failure B — "aurora-bg never visible" on the sign-out test
- **Test:** `auth-signout.spec.ts` (log out clears session → sign-in screen).
- **Technical:** Under the `chromium` project there's **no `storageState`**, so the app isn't
  logged in. The test assumes it starts logged-in (it should run under the `authenticated`
  project) and waits for a logged-in-only element (`aurora-bg`) that never appears → 15s timeout.
- **Normal terms:** This test is supposed to start already logged in, then press log out. It's
  being run logged-*out*, so the screen it expects never shows up and it times out.
- **ELI5:** The test wants to practice "leaving the house," but it was never put *inside* the
  house first — so it just stands outside waiting for a door that isn't there.
- **Severity: BLOCKING.** Config problem, not a product bug.

### Failure C — routine "1 of 1 done" not visible (the genuinely flaky one)
- **Test:** `routine-block-complete.spec.ts` (hold the button → block completes).
- **Technical:** Uses a raw mouse press-and-hold (~600ms) to beat the 250ms hold window in
  `RoutineBlock.tsx`, then checks for the "1 of 1 done" chip. **Passed in some runs, failed in
  others** — a real timing race on slow CI (gesture may fire before the block is interactive).
- **Normal terms:** This one tests the press-and-hold-to-complete gesture. It sometimes works,
  sometimes loses the race on a slow CI machine. It's flaky, not consistently broken.
- **ELI5:** It's like timing a long press on a slow phone — sometimes the phone notices, sometimes
  it doesn't, so the test result flickers.
- **Severity: MEDIUM.** Worth stabilising, but not the main blocker. Low chance of a real bug in
  the hold-to-complete handler — worth a quick confirm.

### Failure D — TypeScript error in `auth.setup.ts` (latent, NOT hitting CI)
- **Technical:** `e2e/auth.setup.ts:74` — `TS2353: 'email' does not exist in type '{ id: string }'`.
  The array is typed too narrowly. **CI doesn't run `tsc`**, so this doesn't fail the build today;
  it only shows locally in `npm run verify`.
- **Normal terms:** A type mistake in a test helper. Harmless right now because CI never
  typechecks — but it *will* bite the moment a typecheck step is added.
- **ELI5:** A small spelling mistake in a notebook nobody reads yet. Fine until someone starts
  reading that notebook.
- **Severity: LOW (latent).**

## 2d. Why your branch still merged despite red CI
The checks are not set as required, so PR #57 merged with E2E failing. Worth knowing: **right now
a red ❌ on a PR doesn't block merging.**

---

# Part 3 — Fix plan (review after you wake up)

Ordered by impact ÷ effort. Items 1–2 turn CI green; the rest are hardening.

### Step 1 — Stop the `chromium` project running auth specs (turns CI green) · effort S · risk Low
In `playwright.config.ts`, the `chromium` project selects specs by `testIgnore` and only excludes
`smoke`, `auth.setup`, `ambient`. **Add the three auth-dependent specs to its `testIgnore`** so
they run *only* under the `authenticated` project (where they already belong, with session +
setup): `auth-routing.spec.ts`, `auth-signout.spec.ts`, `onboarding-fresh.spec.ts`.
- **Why it works:** removes Failures A and B from the always-run chromium step. Those specs then
  only run in the `authenticated` project, which is `continue-on-error: true` (non-blocking) and
  gated on secrets.
- **ELI5:** Stop asking the "leaving the house" and "make a new account" tests to run in the room
  that has no door and no key. Let them run only in the room that does.

### Step 2 — Make the auth specs honest about their requirements · effort S · risk Low
Two sub-options (do at least one):
- **2a.** Add `SUPABASE_SERVICE_ROLE_KEY` as a GitHub repo secret and pass it in `e2e.yml`, so the
  `authenticated` project can actually create ephemeral users and *really* test the fresh-user flow.
- **2b.** In `ephemeralUser.ts` / the specs, `test.skip()` when the service-role env is absent
  (mirroring how `auth.setup.ts` skips without creds) — so a missing secret skips, never errors.
- **Recommended:** 2b now (robust, no secret-handling), 2a later when you want real fresh-user
  coverage in CI.

### Step 3 — Stabilise the press-and-hold test · effort S–M · risk Low
`routine-block-complete.spec.ts`: make the gesture deterministic — wait for the block to be
visible/stable before pressing, lengthen the hold margin, and/or mark it `test.retry(2)`. Confirm
the `RoutineBlock` hold handler doesn't drop a fast pointer sequence (likely fine).

### Step 4 — Add a typecheck gate + fix the latent error · effort S · risk Low
- Fix `e2e/auth.setup.ts:74` by widening the array element type to include `email`/`name`/
  `onboardingStage` (or type it from the real user shape).
- Add a `tsc --noEmit` step to `e2e.yml` (or a tiny separate workflow) so type regressions are
  caught in CI, not just locally. (Note: there is currently **no lint or typecheck in CI at all.**)

### Step 5 — Consider making E2E a required check · effort S · policy
Once green and stable, mark it required so a red build blocks merges (it didn't block #57).

### Step 6 (separate track) — RN component test harness · effort M · risk Med
Add a `jest-expo` + `@testing-library/react-native` jest *project* (kept separate from the node
project so the 623 green logic tests are untouched). Unlocks behaviour tests for Button /
EmptyState / DomainGlyph / staged routine reveal — the design-Wave work that's currently only
smoke-mounted. Do this supervised (new dev-deps + config).

### Then — the deferred coverage (after Steps 1–2 make e2e usable)
Skeletons to add:
- `e2e/welcome-intent.spec.ts` (authenticated): "selecting a chip + Build my day seeds a routine
  and lands on Today"; "Talk it through first opens discovery-chat".
- Extend `onboarding-fresh.spec.ts`: day7-finance shows ₹ presets + accepts a target; day1-routine
  blocks stage in on generate.

---

## Appendix — commands used / how to reproduce
- Full logic suite: `npx jest` (623 pass).
- New tests only: `npx jest src/utils/__tests__/currency.test.ts src/theme/__tests__/domainIcons.test.ts src/finance/gmail/__tests__/fetcher.test.ts`
- Inspect CI: `gh run list --branch lifeosv1 --limit 30`, `gh run view <id> --log-failed`.
- The local-only `npm run verify` = `tsc --noEmit && jest && smoke`; CI does **not** run `tsc`.
