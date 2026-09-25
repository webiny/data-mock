DROP INDEX `project_group_unique`;--> statement-breakpoint
ALTER TABLE `project_groups` ADD `tenant` text DEFAULT 'root' NOT NULL;--> statement-breakpoint
UPDATE `project_groups` SET `tenant` = (SELECT `tenant` FROM `project_environments` WHERE `project_environments`.`id` = `project_groups`.`environment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_group_unique` ON `project_groups` (`environment_id`,`tenant`,`slug`);--> statement-breakpoint
DROP INDEX `project_model_unique`;--> statement-breakpoint
ALTER TABLE `project_models` ADD `tenant` text DEFAULT 'root' NOT NULL;--> statement-breakpoint
UPDATE `project_models` SET `tenant` = (SELECT `tenant` FROM `project_environments` WHERE `project_environments`.`id` = `project_models`.`environment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_model_unique` ON `project_models` (`environment_id`,`tenant`,`model_id`);--> statement-breakpoint
ALTER TABLE `project_tenants` ADD `api_token` text;