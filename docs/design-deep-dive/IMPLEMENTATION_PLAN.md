# Ink + Signal — Phase-wise Implementation Plan

> **Binding inputs:** [00-INDEX.md](00-INDEX.md) (executive summary, 12 cross-spec resolutions, 73 acceptance criteria, open decisions) and the five cluster specs 01–05.
> **This plan is governed by the consumption contract** (00-INDEX.md § How to consume). The criteria referenced below by ID (C1-1 … C5-16) are NOT restated here — the executing session copies them **verbatim from 00-INDEX.md** into each wave's task list. A wave is done only when every copied criterion is individually marked pass **with evidence** (screenshot, test name, or grep output) in the PR. A task that cannot meet a criterion escalates to the founder; it is never quietly rescoped.

## Program shape

Five waves, each one (or a few) independently shippable PR(s). Order is load-bearing:
guards police everything that follows; tokens precede every screen they paint.

```
W0 guards ──▶ W1 ink tokens + wash kill ──▶ W2 structural color + front door ──▶ W3 cold-start + Today ──▶ W4 module screens
   (1 day)        (~half week)                  (~half week)                       (~3 wk, overlapping)      (~3–4 wk)
```

Cross-cutting invariants binding EVERY wave:
- **Hex radar placement on Today: zero diffs** (founder freeze; asserted by C1-6, C3-15, C5-14/15 and per-cluster wording).
- Guard allowlists only shrink (exception: the single founder-approved resolution-8 batch in W3). PR descriptions report the shrink ("ratchet −6").
- Every screen-touching PR ships `docs/DESIGN_REVIEW_CHECKLIST.md` filled, and cites the manifesto principle(s) it serves.
- Verification baseline per wave: `npm run typecheck` (13 known-red test-file errors; 0 non-test), `npx jest` (only `behaviourApply.test.ts` time-flake exempt), web e2e per the criteria, plus the wave's own criteria with evidence.

---

## Wave 0 — Guardrails (Cluster 5) — 1 day, one PR, zero runtime risk

**Branch:** `ink-w0-guardrails` · **Flags:** none · **Criteria to copy verbatim: C5-1 … C5-16 (16)**

Scope (from [05-manifesto-guardrails.md](05-manifesto-guardrails.md) §3):
1. `docs/DESIGN_MANIFESTO.md` — the five locked principles, exact wording from 05 §3.1 (incl. the radar-freeze sentence pinned by C5-15).
2. `CLAUDE.md` philosophy patch (kills "Bold & Expressive"/"Duolingo meets Headspace"; marks aurora-refined-v2 superseded) + the workspace-mirror attestation line in the PR description (C5-2b). Mirror rule: repo CLAUDE.md only — the lifeos-cognition clone is out of scope per repo policy.
3. Five jest files in `src/theme/__tests__/`: Guards A (raw hex), B (string-concat tints), C (ambient-wash imports outside `src/celebration/`), D (LABEL-CAPS), + `manifestoLock.test.ts` (locks the five sentences AND jest.config wiring). Allowlists seeded from landing-day greps with reproducing command in each header (C5-4).
4. `docs/DESIGN_REVIEW_CHECKLIST.md` (10 binary lines) + `.github/PULL_REQUEST_TEMPLATE.md` carrying them verbatim.
5. The §3.5 consumption-contract block added to the dossier file named in C5-14.

**Gate:** C5-14 pins the exact file set of this PR — nothing else may ride along.

## Wave 1 — Ink tokens + wash kill (Cluster 3, PR-1 + PR-2) — ~half week

**Branch:** `ink-w1-tokens` · **Flags: none — hard cutover** (justified in 03 §F; rollback unit = `git revert`) · **Criteria: C3-1, C3-2, C3-3, C3-4, C3-10, C3-11, C3-12, C3-16** (the token/wash subset; remaining C3 criteria close in W2)

PR-1 (tokens): the full `src/theme/colors.ts` replacement from [03-color-system.md](03-color-system.md) §A — `#000000` ground, six full-saturation hues (pinned by C3-12), `*Light`→`*Dim` rename (resolution 1), new `*Text`/`track`/`onPrimary`/`inkOnColor` tokens, `contrast.test.ts` with the §A.6 matrix at ≥4.5:1 in both palettes.
PR-2 (wash kill): delete `AuroraBackground`, `AuroraAnimatedBackground`, `GradientMesh`, `presets.ts` (C3-3); ship `InkCanvas`; aurora survives only inside `src/celebration/` (Guard C boundary). C3-15 pins the `app/(tabs)/index.tsx` diff to exactly two lines — the radar host is otherwise untouched.

**Gate:** visual-regression snapshots are EXPECTED to change here — regenerate baselines in the same PR with before/after pairs attached as evidence.

## Wave 2 — Structural color + front door (Cluster 3, PR-3 + PR-4) — ~half week

**Branch:** `ink-w2-structural` · **Flags: none (continuation of the cutover)** · **Criteria: C3-5 … C3-9, C3-13, C3-14** (closes Cluster 3)

PR-3: `ModuleHeader` full-bleed domain block (rgb values pinned by C3-8), the 43+17 `moduleColor`/`accent` call-site sweep (C3-6 proves it via tsc, not silencing), violet restricted to the five surfaces listed in 03 §C, progress fills solid-on-`c.track` (resolution 3), kill every string-concat tint incl. the voice button (resolution 2, C3-14).
PR-4: sign-in/auth unification — black ground, exactly two violet elements, no backdrop-filter (C3-9, C3-10).

**Gate:** W2 must fully land before W4 (Cluster 4 heroes assume Ink surfaces + `*Text` inks — resolutions 3, 4, 11).

## Wave 3 — Cold start + Today (Clusters 2 then 1) — ~3 weeks, overlapping PRs

**Order within the wave (merge-conflict control):** Cluster 2's small `index.tsx` diffs land BEFORE Cluster 1's composition rewrite.

**PR-A cold start** (`ink-w3-coldstart`) · **Flag: `cold_start_v1` default ON** (FALLBACK_FLAGS, persist key → `lifeos_flags_v4` per resolution 12; Worker = kill switch) · **Criteria: C2-1 … C2-12 (12)**
Scope from [02-cold-start.md](02-cold-start.md): FirstWinCard + collapsed day-1 Rewards, `STARTER_COPY` constants (compassion-linted by C2-8), day-1 quest seeding (`isFirstDay` → exactly 3 drafts, C2-3), firstWin epic celebration with stamp guard (C2-4/5), Profile/Explore/Health/Today zero-surface replacements (as amended by resolutions 5, 6, 7 — the Explore/Health/Today-header treatments defer to Clusters 4/1 where their flags are on).

**PR-B Today recomposition** (`ink-w3-today`) · **Flags: `today_answer_first_v1` + `install_prompt_v2` default OFF → 7-day dogfood → fallback-flip** (next unused persist version at flip, resolution 12) · **Criteria: C1-1 … C1-14 (14)**
Scope from [01-today-hero.md](01-today-hero.md): `TodayHeader` (fixed-height greeting, `formatGreeting` truncation rules C1-2), `NextMoveHero` extracted off Goals (deterministic `useNextMove` hook — no AI import, C1-14), radar hub text-only upgrade + full-signal vertices (C1-7/8) **with placement untouched (C1-6)**, install banner → earned-moment `InstallSheet` (trigger discipline C1-4), telemetry `next_move_shown`/`next_move_completed` (C1-13 + Worker allowlist — deploy Worker before flip).
Resolution-8 founder-approved Guard-D allowlist batch (`TodayHeader.tsx`, `NextMoveHero.tsx`, `FirstWinCard.tsx`) is executed in this wave — the ONE permitted allowlist growth.

**Gate:** dogfood exit = 7 days with block-completion rate not down >5% (01 §3.6); founder makes the flip call (open decision 3).

## Wave 4 — Module screens (Cluster 4) — ~3–4 weeks, 1 foundation PR + 5 screen PRs

**Branch:** `ink-w4-modules` (foundation), then `ink-w4-{health,explore,career,social,finance}` · **Flag: `module_hierarchy_v1`** (cohort 10% → 100%) · **Criteria: C4-1 … C4-15 (15)**

Foundation PR (from [04-module-screens.md](04-module-screens.md) §3.0): `*.legacy.tsx` extraction + byte-identical snapshots (C4-12), `SectionTitle` (LABEL-CAPS killer), `ConnectRow` (import-prompt collapse), `EmptyState.trustNote` (generalizing the Finance keeper pattern), `useHeroSnoozeStore`, `hierarchyGuards.test.ts` (C4-7), and the `*.legacy.tsx` deletion task filed WITH a named owner (open decision 4).
Then five screen PRs in any order behind the flag — each: one hero (testID `{screen}-hero`, C4-1/2), Career value-before-form with the pinned sample-route strings (C4-3/4), banned-strings sweep (C4-5), connect rows last (C4-6), zero-surface suppression (C4-8, supersedes Cluster 2 on these tabs per resolutions 5/6), each PR shrinking the W0 allowlists it touches.

**Gate:** flag graduation to 100% is a founder call; legacy deletion fires after 14 days at 100%.

---

## Founder decisions required before/during execution (from 00-INDEX.md)

1. **Before W0:** ratify the 12 cross-spec resolutions (each then gets a dated inline note in its affected spec).
2. **During W3:** approve the resolution-8 Guard-D allowlist batch (3 files).
3. **After W3 dogfood / W4 cohort:** flip calls for `today_answer_first_v1` + `install_prompt_v2`, and `module_hierarchy_v1` graduation.
4. **At W4 foundation:** name the `*.legacy.tsx` deletion owner.
5. **Standing:** contrast-threshold/pinned-hex changes, locked-sentence/guard edits, and any criterion that can't be met — all founder-gated, never silently rescoped.

## Execution protocol per wave (the anti-dilution loop)

1. Open the wave branch from current trunk; copy the wave's criteria **verbatim** from 00-INDEX.md into the working todo/task list.
2. Implement strictly from the cluster spec (§3 of each) — token names, copy strings, regexes, file paths are exact; deviations get a dated inline note in the spec, founder-flagged.
3. Verify every criterion individually; attach evidence per criterion (test name / grep output / screenshot) in the PR body.
4. Fill `DESIGN_REVIEW_CHECKLIST.md` in the PR; report allowlist ratchet deltas.
5. Merge only when all criteria pass or the founder has explicitly resolved the exceptions.
