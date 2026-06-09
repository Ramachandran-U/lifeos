CREATE TABLE `xp_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`domain` text,
	`source` text NOT NULL,
	`ref_id` text,
	`day_local` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `gamification` ADD `streak_freezes` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `gamification` ADD `freeze_progress_xp` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `gamification` ADD `cosmetics` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `gamification` ADD `companion` text;
