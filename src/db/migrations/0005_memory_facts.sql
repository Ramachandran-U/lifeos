-- ============================================================================
-- 0005_memory_facts
--
-- Durable, long-horizon memory. The 14-day RAG window (historyContext.ts) means
-- the planner forgets anything older than two weeks. This table holds distilled
-- facts that stay true about the user — produced by the consolidation pass
-- (src/ai/memory/consolidate.ts) from behaviour events + reflections.
--
-- Storage decision: embeddings live as a JSON number[] in `embedding` and are
-- ranked with JS cosine (src/ai/rag/memoryStore.ts). No vector DB / extension —
-- fact counts are tens-to-hundreds per user, well within a linear scan.
--
-- TTL / decay: `salience` (0..1) decays over time and is bumped when a fact is
-- re-observed; low-salience facts can be pruned. `expires_at` is an optional
-- hard expiry. The "What LifeOS remembers" screen reads/deletes these rows.
-- ============================================================================

CREATE TABLE `memory_facts` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `kind` text NOT NULL,                  -- preference | pattern | milestone | constraint
  `text` text NOT NULL,                  -- one short natural-language sentence
  `embedding` text,                      -- JSON number[] for JS-cosine retrieval
  `salience` real NOT NULL DEFAULT 1,    -- 0..1; decays over time, bumped on re-observation
  `source_window` text,                  -- e.g. "2026-05-16..2026-05-30"
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `last_seen_at` text NOT NULL DEFAULT (datetime('now')),
  `expires_at` text                      -- nullable; null = no expiry
);
--> statement-breakpoint

CREATE INDEX `memory_facts_user_idx` ON `memory_facts` (`user_id`, `salience`);
