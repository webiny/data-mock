CREATE TABLE `project_tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`discovered_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_tenant_unique` ON `project_tenants` (`project_id`,`tenant_id`);