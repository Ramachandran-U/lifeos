# Git Worktrees in LifeOS

How to spin up an isolated working tree, use it safely, and tear it down — plus a snapshot of the worktrees that exist today.

## Why we use worktrees

The primary tree (`C:\personal\Project X\lifeos`) is often churned by **parallel Claude/agent sessions** — its `HEAD` and files move under you mid-task. A `git worktree` gives you a second checked-out branch in its own directory that shares the **one** `.git` object store, so you can:

- Build a clean PR off `lifeosv1` while the primary tree sits on some `test/*` branch.
- Run `tsc` / `jest` against a stable set of files that nobody else is editing.
- Keep a long-running experiment isolated without `git stash` juggling.

A second full clone (`lifeos-cognition/`) exists for the same reason but is a *separate* clone on its own remote-tracking branch; worktrees are lighter (shared object store, no re-clone).

## ⚠️ The one rule: never junction/symlink `node_modules`

This bit us once and cost a full `npm ci` recovery for two sessions. On Windows, a **directory junction** from a worktree's `node_modules` → the primary tree's real `node_modules` looks convenient, but:

- `Remove-Item -Recurse`, `[System.IO.Directory]::Delete(path, ...)`, and `rm -rf` all **recurse *through* the junction** and delete the *target's* contents — i.e. they empty the real `node_modules` that every other tree depends on.
- Branches also diverge in their jest preset / dependency tree, so a shared `node_modules` breaks preset resolution anyway.

**Do this instead:** run a real `npm ci` inside the worktree (slower, fully isolated). It's the only safe option.

If you ever *must* delete a junction, use `cmd /c rmdir "path"` (no `/s`) — that removes only the link. Never `Remove-Item -Recurse` / `rm -rf` on a junction.

## Recipe — create a worktree (the steps used for `lifeos-scratch`)

Run from the primary tree. Replace `<name>` and `<branch>` as needed.

```powershell
# 1. Make sure the PR base is current (no surprise drift)
git fetch origin lifeosv1
git rev-list --left-right --count lifeosv1...origin/lifeosv1   # want "0  0"

# 2. Add the worktree on a NEW branch, based on lifeosv1.
#    Sibling layout (matches lifeos-cognition):
git worktree add "C:\personal\Project X\lifeos-<name>" -b feat/<name> lifeosv1
#    …or Claude-managed layout (matches the others under .claude/worktrees):
#    git worktree add ".claude\worktrees\<name>" -b feat/<name> lifeosv1

# 3. Real, isolated install — NOT a junction (see the rule above)
npm ci --prefix "C:\personal\Project X\lifeos-<name>"

# 4. Copy the gitignored secrets the tracked .example files don't carry.
#    The app runtime needs .env; the test run needs .env.test.
Copy-Item "C:\personal\Project X\lifeos\.env"      "C:\personal\Project X\lifeos-<name>\.env"      -Force
Copy-Item "C:\personal\Project X\lifeos\.env.test" "C:\personal\Project X\lifeos-<name>\.env.test" -Force

# 5. Confirm those env files stay ignored (status should be clean)
git -C "C:\personal\Project X\lifeos-<name>" check-ignore .env .env.test
git -C "C:\personal\Project X\lifeos-<name>" status --short
```

Notes:
- `.env` / `.env.test` are gitignored in **both** trees, so copying them never risks committing secrets — step 5 verifies this.
- Only `.env.example` and `.env.test.example` are tracked and arrive automatically with the checkout; the real values do not.
- Base off `lifeosv1` for anything you intend to PR. Base off the current `test/*` branch only if you specifically need its in-progress work.

## Using a worktree safely

```powershell
# Type-check / test inside the worktree without leaving the primary tree:
npm --prefix "C:\personal\Project X\lifeos-<name>" run lint        # if defined
npx --prefix "C:\personal\Project X\lifeos-<name>" tsc --noEmit
npx jest --rootDir "C:\personal\Project X\lifeos-<name>"           # or cd in first
```

- A branch can only be checked out in **one** worktree at a time — git refuses a second checkout of the same branch. That's a feature: it stops two trees fighting over the same ref.
- `git` commands run against whichever tree's directory you point at (`git -C <path> …`). The object store, stashes, and remotes are shared.
- Per CLAUDE.md, **edit docs only in the primary `lifeos/` tree** — keep doc edits out of throwaway worktrees so they don't get lost on cleanup.
- Don't deploy/ship from a scratch worktree; open a PR from its branch like any other.

## Tear-down (safe cleanup)

Because the install is a **real** directory (not a junction), normal removal is safe:

```powershell
# Remove the worktree dir + its real node_modules in one safe step:
git worktree remove "C:\personal\Project X\lifeos-<name>"
# If it has uncommitted changes you want to discard, add --force.

# Then optionally delete the branch (only if merged / abandoned):
git branch -d feat/<name>     # -D to force-delete an unmerged branch

# Housekeeping if a dir was deleted out from under git:
git worktree prune
```

Never `Remove-Item -Recurse` a worktree that contains a junction (we don't create those — see the rule). For a real worktree, prefer `git worktree remove` over manual deletion so git's metadata stays consistent.

## Current worktrees (snapshot — 2026-06-04)

> Live state drifts; regenerate with `git worktree list`.

| Path | Branch | Purpose |
|------|--------|---------|
| `lifeos` | `test/workstream-a-p1` | Primary tree (churned by parallel sessions) |
| `lifeos-scratch` | `feat/scratch` | Fresh feature scratch tree off `lifeosv1` (this doc's example) |
| `lifeos-cognition` | `claude/cognition-sync` | Separate full clone — cognition/sync work |
| `lifeos\.claude\worktrees\compaction-fix` | `worktree-compaction-fix` | Claude-managed worktree |
| `lifeos\.claude\worktrees\strange-greider-fa987b` | `claude/strange-greider-fa987b` | Claude-managed worktree |
| `lifeos\.claude\worktrees\wt-fe4cf2` | `claude/wt-fe4cf2` | Claude-managed worktree |

## Layout conventions

- **`lifeos-<name>` siblings** — human-driven, longer-lived trees you cd into directly (mirrors `lifeos-cognition`).
- **`.claude/worktrees/<name>`** — created by Claude Code's worktree tooling for isolated agent runs; auto-cleaned when unchanged.

Both are equally valid; pick the sibling layout when you want an obvious top-level folder, the `.claude` layout when an agent is managing the lifecycle.
