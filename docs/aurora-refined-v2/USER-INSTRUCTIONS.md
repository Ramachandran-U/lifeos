# USER · step-by-step

Your workflow for getting Aurora Refined v2 into the LifeOS codebase via
Claude Code. Allocate ~3-4 hours for a focused session; you can pause between
phases without losing state (each phase commits).

---

## Before you start

You need:

- [ ] Repo cloned and working: `git clone git@github.com:Ramachandran-U/lifeos.git && cd lifeos`
- [ ] Branch checked out: `git checkout lifeosv1` (the default branch)
- [ ] Dependencies installed: `npm install`
- [ ] Baseline green: `npm test` passes locally
- [ ] Smoke baseline green: `npm run smoke:local` passes (start the web app first if needed)
- [ ] Claude Code installed and authenticated
- [ ] **This handover folder** copied into the repo at `docs/aurora-refined-v2/`

If any of the four "green" checks above fail on `main`, fix that first
before starting the refinement pass. Don't paint over a broken base.

---

## Step 1 · Create the refinement branch

```bash
cd /path/to/lifeos
git checkout lifeosv1
git pull
git checkout -b aurora-refined-v2
```

All work happens on `aurora-refined-v2`. You'll open one PR at the end.

---

## Step 2 · Drop the handover into the repo

The folder you're reading right now (`handover/` in the design project)
becomes `docs/aurora-refined-v2/` in the LifeOS repo.

```bash
mkdir -p docs/aurora-refined-v2
# Copy these five files into it:
#   README.md
#   DELTA.md
#   MOTION.md
#   PROMPTS.md
#   USER-INSTRUCTIONS.md  (this file — optional, kept for reference)
```

Commit:

```bash
git add docs/aurora-refined-v2
git commit -m "docs(aurora-v2): land refinement handover"
```

This commit is **separate from any code change** so a reviewer can read
the handover docs as their first commit on the PR.

---

## Step 3 · Open Claude Code at the repo root

```bash
cd /path/to/lifeos
claude
```

Confirm Claude Code can see the repo and the new `docs/aurora-refined-v2/`
folder. If you're in a fresh session, run `/init` or whatever your client
uses to ensure project context is loaded.

---

## Step 4 · Run the phases

Open `docs/aurora-refined-v2/PROMPTS.md`. There are 11 prompts (Phase 0
through Phase 10). For each one:

1. **Read** the phase's intent and gate in PROMPTS.md.
2. **Copy** the prompt block into Claude Code.
3. **Wait** for Claude Code to finish.
4. **Review** the diff Claude Code shows. Read every changed file. If
   you don't understand a change, ask Claude Code to explain it before
   committing.
5. **Verify** the gate yourself (run the same `npm` commands Claude Code
   ran, on your own terminal, to double-check).
6. **Commit** using the suggested message at the end of each phase block.

```bash
git add -p     # stage interactively, line-by-line if you want to be careful
git commit -m "feat(motion): add EASING tokens and MOTION_BUDGET constants"
```

7. **Visual check** for phases that change pixels (4, 5, 6, 7, 8, 9):
   start the web app, navigate to the relevant screen, confirm the change
   looks right.

```bash
npm run web
# Open http://localhost:8081 (or whatever Expo prints)
```

If something looks wrong at this point, **stop and fix it before
proceeding**. Don't pile phases on top of a broken state.

---

## Step 5 · Phase order

Each phase has its own gate. Don't skip ahead.

| # | Title | Time | Files touched |
|---|-------|------|---------------|
| 0 | Orient | 5 min | (read only) |
| 1 | Tokens · elevation + radii | 10 min | 2 files |
| 2 | Motion easings + budget | 10 min | 1 file |
| 3 | Shared primitives drop glow | 20 min | 3 files |
| 4 | HexRadar refinements | 20 min | 1 file |
| 5 | Gamification quiet-down | 30 min | 3 files |
| 6a | RoutineBlock · drop glow | 10 min | 1 file |
| 6b | RoutineBlock · long-press | 30 min | 1-3 files (incl e2e) |
| 7 | Today · stagger + sticky | 40 min | 1 file |
| 8 | DailyBriefing · typed reveal | 20 min | 1-2 files |
| 9 | Sheets · enter/exit polish | 20 min | 2 files |
| 10 | Final sweep | 15 min | (verify only) |

Total budget: about 3.5 hours of focused work, with breaks fine.

---

## Step 6 · After all phases

When Phase 10's audit is clean, you have a refined branch. Push and open
a PR:

```bash
git push -u origin aurora-refined-v2
gh pr create --base lifeosv1 \
  --title "Aurora Refined v2 — surgical motion + visual pass" \
  --body-file docs/aurora-refined-v2/README.md
```

Or use the GitHub web UI. Either way, **attach before/after screenshots**:

- Today screen (focus on the radar + timeline)
- Health screen
- Finance screen
- Rewards screen (this is where the quiet-down is most visible)
- A short screen recording of: long-press to complete a routine block,
  scroll Today to trigger the sticky header, open and close one of the
  sheets.

If you don't have a screen recorder handy, even three screenshots
(before / mid-motion / after) tell the story.

---

## Step 7 · Review the PR yourself before requesting review

Open the PR's "Files changed" tab. For each file:

- [ ] Does the diff match the intent in DELTA.md or MOTION.md?
- [ ] Are there any sneaky changes Claude Code made that weren't in the
      prompt? (Should be very rare, but worth checking.)
- [ ] Are the tests + snapshots updated correctly?

If any file has surprise changes, ask Claude Code to justify them or
revert them in a follow-up commit.

---

## Common issues + their fixes

### "Claude Code keeps editing files I told it not to."

Reaffirm the hard rules from README.md at the start of the misbehaving
prompt. If it persists, the simplest fix: paste the relevant DELTA.md
section explicitly into the prompt instead of referring to it by name.

### "The TypeScript build broke after Phase 2."

`EASING` and `MOTION_BUDGET` are new exports. If anywhere else in the
code imported a name like `EASING` from a different location, you'll get
a duplicate-identifier error. Find with:

```bash
grep -rn "EASING" src/ --include="*.ts" --include="*.tsx"
```

Rename the existing one or relocate the new export.

### "The snapshot tests are all red after Phase 3."

Expected. Visual changes invalidate snapshots. Regenerate with:

```bash
npm test -- -u
```

Then **review the snapshot diff** — Jest will show what changed inline.
If the new snapshot matches the intended refinement (less glow, smaller
dots), commit it. If it shows something you didn't expect, debug first.

### "Smoke test fails because a selector can't find a button."

Phase 6b might have changed what a "tap routine block" gesture does
(it's now a long-press). If your smoke test was tapping, it needs to
hold. Update the test:

```ts
// Before
await page.click('[data-testid="routine-block-1"]');

// After
await page.locator('[data-testid="routine-block-1"]').dispatchEvent('pointerdown');
await page.waitForTimeout(1100);  // hold past HOLD_MS
await page.locator('[data-testid="routine-block-1"]').dispatchEvent('pointerup');
```

(Or whichever press-and-hold API Playwright recommends for your version.)

### "The web preview looks fine but the iOS preview has a different feel."

`Platform.OS === 'web'` branches exist throughout the codebase. The
refinement preserves them. If iOS feels too quiet, check:
- That `expo-haptics` is firing on commit (Phase 6b's long-press should
  trigger one notification haptic per completion).
- That `Animated.View` with `entering={FadeIn}` is rendering — Reanimated
  4 needs a layout pass to fire entry animations; if your screen is
  rendered inside a `Suspense` boundary that resolves after mount, the
  cascade may have already finished.

### "I want to undo Phase N and redo it differently."

```bash
git log --oneline                    # find the SHA of the commit before Phase N
git revert <SHA>..HEAD               # revert all phases since then (writes new commits)
# or, if no one else has pulled the branch:
git reset --hard <SHA>               # destructive reset
```

Then re-run the prompts for the phases you want.

---

## What the PR description should say

Suggested body (Claude Code will produce one at Phase 10):

> ### Aurora Refined v2 — motion + visual refinement pass
>
> A surgical refinement of the existing Aurora Refined system. **No layout
> changes, no new screens, no palette changes.** What changes is posture:
> less neon, less glow, more tactile.
>
> #### What's in this PR
>
> - **Token tuning.** `elevation.ts` drops the primary-color halo on z3.
>   `radii.ts` extends with `lg` and `xl`.
> - **Motion vocabulary.** New `EASING` tokens (`bounce`, `pulse`) +
>   `MOTION_BUDGET` constants. Existing `SPRING` / `TIMING` unchanged.
> - **Component refinements.** `HexRadar`, `GlassCard`, `RoutineBlock`,
>   `StreakRow`, `BadgeCard`, `XpBar`, `AvatarRing`, `StreakFlame` —
>   dropped all `boxShadow` glow, reduced gamification visual loudness.
> - **Interaction.** `RoutineBlock` now uses long-press-to-complete with
>   a press-progress arc + commit haptic.
> - **Motion scenes.** Today screen mount stagger, scroll-driven sticky
>   header, daily briefing typed reveal, sheet enter/exit polish.
>
> #### Verification
>
> - `npm test`: green
> - `npm run evals`: green (no AI behavior changed)
> - `npm run smoke:local`: green
> - `tsc --noEmit`: green
>
> #### Out of scope
>
> AI logic, RAG, evals, integrations, data model.
>
> #### Design source
>
> See `docs/aurora-refined-v2/` for the full handover.

---

## When you're done

Merge the PR. Celebrate quietly. The refined Aurora is in the app.
