-- ============================================================================
-- 0006_rabbit_hole_trees
--
-- Explore v3 — the navigable rabbit-hole DECISION-TREE MAP, replacing the old
-- destructive linear stack. See docs/rabbit-hole-tree-map-redesign.md.
--
-- `rabbit_hole_trees`: one row per tree. The WHOLE tree (nodeMap + rootId +
-- cursorId) is a single JSON blob in `tree_json`, so the web render path reads
-- it synchronously and the deterministic layout stays a pure function of one
-- object. LOCAL ONLY — rabbit-hole sync is parked (Phase 7), so writes are NOT
-- routed through the mutation log. `sparks.thread_id` is stamped with the tree
-- id on creation.
--
-- `constellation_edges`: a local, rebuildable edge source. Rabbit-hole journeys
-- emit led_to / synapse edges here on qualifying milestones; projectConstellation()
-- reads them as an extra edge source. Bypasses the sync mutation log.
-- ============================================================================

CREATE TABLE `rabbit_hole_trees` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `spark_id` text NOT NULL,
  `anchor_json` text NOT NULL,             -- JSON: RabbitHoleAnchor
  `tree_json` text NOT NULL,               -- JSON: { nodeMap, rootId, cursorId }
  `scoring_json` text NOT NULL,            -- JSON: RabbitHoleScoring (idempotency ledger)
  `title` text,                            -- null until the user (optionally) names the map
  `xp_awarded` integer NOT NULL DEFAULT 0, -- running total banked so far
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now')),
  `deleted_at` text                        -- soft delete; 90-day prune
);
--> statement-breakpoint

CREATE INDEX `rabbit_hole_trees_user_idx` ON `rabbit_hole_trees` (`user_id`, `created_at`);
--> statement-breakpoint

CREATE INDEX `rabbit_hole_trees_spark_idx` ON `rabbit_hole_trees` (`spark_id`);
--> statement-breakpoint

CREATE TABLE `constellation_edges` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `from_id` text NOT NULL,
  `to_id` text NOT NULL,
  `relation` text NOT NULL,                -- within | synapse | led_to
  `weight` integer NOT NULL DEFAULT 1,
  `source_tree_id` text,                   -- the rabbit-hole tree that produced it
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint

CREATE INDEX `constellation_edges_user_idx` ON `constellation_edges` (`user_id`);
