CREATE TABLE `project_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`remote_id` text,
	`synced_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_group_unique` ON `project_groups` (`project_id`,`slug`);--> statement-breakpoint
CREATE TABLE `project_models` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`group_slug` text NOT NULL,
	`model_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`fields` text NOT NULL,
	`remote_id` text,
	`synced_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_model_unique` ON `project_models` (`project_id`,`model_id`);