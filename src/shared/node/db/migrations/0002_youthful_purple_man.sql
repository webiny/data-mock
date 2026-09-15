CREATE TABLE `child_processes` (
	`id` text PRIMARY KEY NOT NULL,
	`pid` integer NOT NULL,
	`owner_pid` integer NOT NULL,
	`job_id` text,
	`command` text NOT NULL,
	`cwd` text NOT NULL,
	`started_at` integer NOT NULL
);
