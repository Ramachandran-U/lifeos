CREATE TABLE IF NOT EXISTS `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`nickname` text,
	`relationship_type` text NOT NULL,
	`preferred_cadence_days` integer NOT NULL,
	`last_contact_date` text,
	`notes` text,
	`birthday` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `contact_interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `contacts_user_idx` ON `contacts` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `contact_interactions_contact_idx` ON `contact_interactions` (`contact_id`);
