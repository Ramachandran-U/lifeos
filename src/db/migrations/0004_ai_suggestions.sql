-- ============================================================================
-- 0004_ai_suggestions
--
-- Adds suggestion-level telemetry so we can measure whether AI suggestions
-- actually improve user outcomes (not just whether the model returns valid JSON).
--
-- ai_suggestions:        one row per suggestion the AI emits.
-- suggestion_outcomes:   linked row per suggestion measuring downstream effect.
--
-- ─── Decision this informs ──────────────────────────────────────────────────
-- KILL/KEEP HYPOTHESIS (per devil's-advocate roadmap review):
--   The multi-step agent path (e.g. planRoutineAgent, and the goal-decomp
--   agent being introduced in R2.2) is gated behind a feature flag.
--
--   AT N = 14 DAYS after enabling the flag for a user:
--     - Compute block-completion rate for routines produced by the AGENT path.
--     - Compute block-completion rate for routines produced by the SINGLE-SHOT
--       baseline path over the same window.
--   IF agent completion-rate < baseline completion-rate
--   AND the difference is greater than 3 percentage points,
--   THEN the agent flag is killed for that task and the single-shot path
--   becomes the default again.
--
-- N=14 is chosen because shorter windows are dominated by weekday/weekend mix
-- noise. We do not pretend N<14 is signal.
--
-- "domain_score_delta" is captured for context but is NOT the kill/keep metric
-- — domain scores move too slowly and are too noisy at the individual level.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE `ai_suggestions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `task` text NOT NULL,                  -- e.g. 'routine.generate', 'goal.decompose'
  `variant` text NOT NULL,               -- 'single_shot' | 'agent'
  `model` text,                          -- model id reported by proxy
  `input_hash` text NOT NULL,            -- SHA-256 of the canonicalised input (no PII stored raw)
  `output_summary` text,                 -- short opaque summary of what was suggested (e.g. block count, goal id)
  `output_ref` text,                     -- foreign id pointing to the durable artefact (routine date, goal id, ...)
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint

CREATE INDEX `ai_suggestions_user_task_idx` ON `ai_suggestions` (`user_id`, `task`, `created_at`);
--> statement-breakpoint

CREATE TABLE `suggestion_outcomes` (
  `id` text PRIMARY KEY NOT NULL,
  `suggestion_id` text NOT NULL,
  `window_days` integer NOT NULL,        -- always 14 for the kill/keep decision; other windows allowed for exploration
  `blocks_total` integer,                -- denominator for completion-rate when task is routine-shaped
  `blocks_completed` integer,            -- numerator
  `completion_rate` real,                -- blocks_completed / blocks_total (nullable for non-routine tasks)
  `domain_score_delta` real,             -- context only, NOT the decision metric
  `measured_at` text NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (`suggestion_id`) REFERENCES `ai_suggestions`(`id`)
);
--> statement-breakpoint

CREATE INDEX `suggestion_outcomes_suggestion_idx` ON `suggestion_outcomes` (`suggestion_id`);
