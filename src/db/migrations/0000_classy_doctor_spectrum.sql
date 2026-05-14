CREATE TABLE IF NOT EXISTS `behaviour_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`module` text NOT NULL,
	`metadata` text,
	`hour` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `blood_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`report_name` text NOT NULL,
	`parsed_markers` text,
	`ai_summary` text,
	`ai_suggestions` text,
	`raw_file_uri` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `daily_reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`mood` integer,
	`block_reviews` text NOT NULL,
	`tweak_accepted` integer,
	`tweak_payload` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `discovery_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`raw_text` text NOT NULL,
	`extracted` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `exploration_log` (
	`id` text PRIMARY KEY NOT NULL,
	`interest_id` text NOT NULL,
	`date` text NOT NULL,
	`minutes_spent` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `finance_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`title` text NOT NULL,
	`target_amount` real NOT NULL,
	`target_date` text NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `financial_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`goal_type` text NOT NULL,
	`target_amount` real,
	`currency` text DEFAULT 'USD' NOT NULL,
	`target_date` text,
	`income_bracket` text,
	`monthly_savings` real,
	`risk_profile` text,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `food_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`meal_type` text NOT NULL,
	`food_name` text NOT NULL,
	`quantity_g` real NOT NULL,
	`calories` real NOT NULL,
	`protein` real NOT NULL,
	`carbs` real NOT NULL,
	`fat` real NOT NULL,
	`fibre` real,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `gamification` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`domain_scores` text DEFAULT '{}' NOT NULL,
	`streaks` text DEFAULT '{}' NOT NULL,
	`badges` text DEFAULT '[]' NOT NULL,
	`total_xp` integer DEFAULT 0 NOT NULL,
	`weekly_xp` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `goal_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`goal_type` text NOT NULL,
	`parent_id` text,
	`level` text NOT NULL,
	`timeline` text,
	`status` text DEFAULT 'active' NOT NULL,
	`energy_level` text,
	`ai_generated` integer DEFAULT false,
	`metadata` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `health_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`weight` real,
	`sleep_hours` real,
	`steps` integer,
	`energy_level` integer,
	`notes` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `interests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`weekly_minutes_target` integer NOT NULL,
	`weekly_minutes_actual` integer DEFAULT 0 NOT NULL,
	`enjoyment_level` integer,
	`exploration_depth` text DEFAULT 'taste' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`discovered_by` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `routine_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`title` text NOT NULL,
	`module` text NOT NULL,
	`linked_entity_id` text,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`calendar_event_id` text,
	`energy_required` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`profile` text NOT NULL,
	`source` text NOT NULL,
	`confidence_overall` real DEFAULT 0 NOT NULL,
	`routine_unlocked` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`name` text NOT NULL,
	`age` integer,
	`height_cm` real,
	`vision_statement` text,
	`wake_time` text,
	`sleep_time` text,
	`work_start_time` text,
	`work_end_time` text,
	`onboarding_stage` integer DEFAULT 0 NOT NULL,
	`primary_domains` text,
	`activated_modules` text,
	`install_date` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);