# LifeOS — Bug & Request Log

> Running log of issues and feature requests surfaced during testing, with status + where they were fixed. Newest batch at the bottom. "Fixed (commit)" links the commit/PR that resolved it; "Needs ops" means the code is ready but a dashboard/secret/deploy action is required.

Last updated: 2026-05-27

---

## Legend
- ✅ **Fixed** — shipped to `aurora-refined-v2` + merged to `lifeosv1`, live on `lifeos-6r5-eqa.pages.dev`
- 🟡 **Mitigated** — partial/client-side fix shipped; durable fix needs a follow-up
- 🔧 **Needs ops** — code correct; requires a manual dashboard/secret/deploy action
- 🔁 **Not reproduced** — code path verified correct; likely environment/cache

---

## Batch 1 — UI / fixes (PR #29)

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | Hex bar edges need clean minimal symbols/icons | ✅ Fixed | `520735c` — domain glyphs (◆ ♥ ◈ ▲ ● ✦) at each HexRadar vertex |
| 2 | Editing routine times → Generate throws an error | ✅ Fixed | `520735c` — `"Unbalanced JSON"`: agent propose/critique had no `maxTokens` → worker's 1200 default truncated output. Raised to 3000/3500 |
| 3 | Hold-to-complete competes with mobile long-press copy | ✅ Fixed | `520735c` — hold 1000→250ms + web `userSelect:none`/`touchAction:manipulation` |

---

## Batch 2 — streaks / report / profile (PR #30)

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | Streaks not saved / populated | ✅ Fixed | `3b1a622` — `loadFromDB` replaced `DEFAULT_STREAKS` with `'{}'`, wiping keys; `triggerStreak` then threw. Now merges over defaults |
| 2 | Voice assistant shows websocket error | 🔧 Needs ops | `3b1a622` — clearer client message shipped; **root cause = worker `GEMINI_API_KEY` secret not set** (`wrangler secret put GEMINI_API_KEY` in `workers/ai-proxy`) |
| 3 | profile → Notifications redirects to Today | 🔁 Not reproduced | Allow-listed + smoke nav test passes on current deploy. Stale PWA cache — hard-refresh resolves |
| 4 | what-lifeos-knows: copy AI prompt + paste back | ✅ Fixed | `3b1a622` — "Understand me better" card (Copy prompt + Paste results) wired to discovery extraction round-trip |
| 5 | profile/Appearance should be collapsible | ✅ Fixed | `3b1a622` — collapsed by default, tap header to expand |
| 6 | 28-day report shows "No report available" | ✅ Fixed | `3b1a622` — gated on a `user_profiles` row legacy users lack; falls back to empty profile, generates from routine/behaviour data |

---

## Batch 3 — health / engagement / goals (in progress)

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | Saved vitals not persisting (health) — must re-enter | ⏳ In progress | — |
| 2 | Dynamic scroll-reactive background (vs static) | ⏳ In progress | — |
| 3 | Option to log yesterday's progress if missed | ⏳ In progress | — |
| 4 | All-tasks-complete → confetti + daily-summary popup | ⏳ In progress | — |
| 5 | Swipe-left to uncheck an accidentally-completed block | ⏳ In progress | — |
| 6 | Add goal → decompose: "AI returned invalid GoalHierarchy. Unbalanced JSON" | ⏳ In progress | Same truncation class as Batch-1 #2; durable fix needs worker `MAX_TOKENS_CAP` raised to 8000 |

---

## Known follow-ups (flagged, not yet scheduled)
- **`generateWeekRoutine` ("Plan my next 7 days")** requests `maxTokens: 6000` but the worker caps client requests at 4096 → a 7-day plan truncates the same way. Durable fix: raise the worker's `MAX_TOKENS_CAP` env to 8000 (also fixes Batch-3 #6 headroom) or chunk generation.
- **Worker `MAX_TOKENS_CAP`** default is 4096 (hard max 8000). Several large-output AI calls (goal hierarchy, week routine) sit near or above it. Raising the env var to 8000 + redeploying the worker is the single highest-leverage backend change.
