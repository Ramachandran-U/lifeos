-- ============================================================================
-- 0010_day_summaries
--
-- Episodic memory: one narrative record per lived day. behaviour_events are
-- counters ("3× block_completed") — they can't answer "what did last Tuesday
-- actually look like?". This table holds an AI-written (or deterministic
-- fallback) paragraph per day plus the day's stats, written at evening-reflect
-- behind the `episodic_memory` flag (src/ai/episodic/daySummary.ts).
--
-- Consumers: memory consolidation (richer window signal), the routine
-- planner's retrieval pool, and the `getRecentDays` agent recall tool.
--
-- LOCAL ONLY v1: derived from already-synced reflections + blocks and fully
-- regenerable, so writes bypass the mutation log (same posture as
-- behaviour_events). Revisit if cross-device recall is wanted.
-- ============================================================================

CREATE TABLE `day_summaries` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `date` text NOT NULL,                  -- YYYY-MM-DD
  `summary` text NOT NULL,               -- narrative paragraph for the day
  `stats_json` text NOT NULL,            -- JSON DaySummaryStats
  `source` text NOT NULL,                -- 'ai' | 'fallback'
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint

CREATE UNIQUE INDEX `day_summaries_user_date_idx` ON `day_summaries` (`user_id`, `date`);
