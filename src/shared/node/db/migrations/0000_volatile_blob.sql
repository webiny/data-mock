CREATE TABLE `child_processes` (
	`id` text PRIMARY KEY NOT NULL,
	`pid` integer NOT NULL,
	`owner_pid` integer NOT NULL,
	`job_id` text,
	`command` text NOT NULL,
	`cwd` text NOT NULL,
	`started_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`environment_id` text,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`config` text,
	`logs` text,
	`result` text,
	`progress` integer,
	`progress_label` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `project_environments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_environments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`env` text NOT NULL,
	`variant` text DEFAULT '' NOT NULL,
	`region` text,
	`deployed` integer DEFAULT 0 NOT NULL,
	`api_url` text,
	`admin_url` text,
	`api_token` text,
	`tenant` text DEFAULT 'root' NOT NULL,
	`last_synced_at` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_environment_unique` ON `project_environments` (`project_id`,`env`,`variant`);--> statement-breakpoint
CREATE TABLE `project_files` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`tenant` text NOT NULL,
	`file_key` text NOT NULL,
	`file_url` text NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size` integer,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `project_environments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_file_unique` ON `project_files` (`environment_id`,`file_key`);--> statement-breakpoint
CREATE TABLE `project_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`remote_id` text,
	`synced_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `project_environments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_group_unique` ON `project_groups` (`environment_id`,`slug`);--> statement-breakpoint
CREATE TABLE `project_models` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`group_slug` text NOT NULL,
	`model_id` text NOT NULL,
	`name` text NOT NULL,
	`singular_api_name` text NOT NULL,
	`plural_api_name` text NOT NULL,
	`description` text,
	`fields` text NOT NULL,
	`plugin` integer DEFAULT 0 NOT NULL,
	`remote_id` text,
	`synced_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `project_environments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_model_unique` ON `project_models` (`environment_id`,`model_id`);--> statement-breakpoint
CREATE TABLE `project_stacks` (
	`id` text PRIMARY KEY NOT NULL,
	`environment_id` text NOT NULL,
	`app` text NOT NULL,
	`deployed` integer DEFAULT 0 NOT NULL,
	`resource_count` integer,
	`stack_output` text,
	`read_state` text NOT NULL,
	`synced_at` integer,
	FOREIGN KEY (`environment_id`) REFERENCES `project_environments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_stack_unique` ON `project_stacks` (`environment_id`,`app`);--> statement-breakpoint
CREATE TABLE `project_tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`discovered_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `project_environments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_tenant_unique` ON `project_tenants` (`environment_id`,`tenant_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`root_path` text,
	`webiny_version` text,
	`version_source` text,
	`version_major` integer,
	`operations_version` text DEFAULT '6.0.0' NOT NULL,
	`pulumi_backend` text,
	`aws_profile` text,
	`aws_region` text,
	`last_synced_at` integer,
	`last_sync_status` text,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_roots` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scan_roots_path_unique` ON `scan_roots` (`path`);--> statement-breakpoint
CREATE TABLE `seed_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`project_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`tenant` text NOT NULL,
	`model_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`entry_data` text NOT NULL,
	`request_data` text,
	`response_data` text,
	`http_status` integer,
	`status` text NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `seed_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `project_environments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `seed_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`status` text NOT NULL,
	`config` text NOT NULL,
	`result` text,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `project_environments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `seed_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seed_template_unique` ON `seed_templates` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `sync_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`message` text NOT NULL,
	`request` text,
	`response` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `project_environments`(`id`) ON UPDATE no action ON DELETE cascade
);
