CREATE TABLE `quests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day_local` text NOT NULL,
	`kind` text DEFAULT 'daily' NOT NULL,
	`title` text NOT NULL,
	`module` text NOT NULL,
	`metric_key` text NOT NULL,
	`target` integer NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`xp` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`source` text DEFAULT 'template' NOT NULL,
	`template_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `quests_user_day_idx` ON `quests` (`user_id`,`day_local`);
