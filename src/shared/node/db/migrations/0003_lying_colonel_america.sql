PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`config` text,
	`logs` text,
	`progress` integer,
	`progress_label` text,
	`parent_job_id` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_jobs`("id", "project_id", "type", "status", "config", "logs", "progress", "progress_label", "parent_job_id", "started_at", "completed_at", "created_at") SELECT "id", "project_id", "type", "status", "config", "logs", "progress", "progress_label", "parent_job_id", "started_at", "completed_at", "created_at" FROM `jobs`;--> statement-breakpoint
DROP TABLE `jobs`;--> statement-breakpoint
ALTER TABLE `__new_jobs` RENAME TO `jobs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;