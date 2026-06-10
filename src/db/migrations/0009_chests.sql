CREATE TABLE `chests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`seed` text NOT NULL,
	`contents` text,
	`day_local` text NOT NULL,
	`granted_at` text NOT NULL,
	`claimed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `chests_user_day_idx` ON `chests` (`user_id`,`day_local`);
