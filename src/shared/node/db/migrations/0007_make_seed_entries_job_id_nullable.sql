PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_seed_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`project_id` text NOT NULL,
	`tenant` text NOT NULL,
	`model_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`entry_data` text NOT NULL,
	`response_data` text,
	`http_status` integer,
	`status` text NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `seed_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_seed_entries`("id", "job_id", "project_id", "tenant", "model_id", "entry_id", "entry_data", "response_data", "http_status", "status", "error", "created_at") SELECT "id", "job_id", "project_id", "tenant", "model_id", "entry_id", "entry_data", "response_data", "http_status", "status", "error", "created_at" FROM `seed_entries`;--> statement-breakpoint
DROP TABLE `seed_entries`;--> statement-breakpoint
ALTER TABLE `__new_seed_entries` RENAME TO `seed_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;