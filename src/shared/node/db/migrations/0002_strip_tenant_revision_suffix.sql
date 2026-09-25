-- Tenant discovery stored the wbyTenant entry's revision id (`6ab6…#0001`) as the tenant id. The
-- tenant id is the entry id, without the `#nnnn` suffix. Strip it everywhere a tenant is stored.
-- OR IGNORE: a row whose stripped id already exists is left alone rather than failing the
-- migration; the leftover tenant rows are removed below and come back on the next pull.
UPDATE OR IGNORE `project_tenants` SET `tenant_id` = substr(`tenant_id`, 1, instr(`tenant_id`, '#') - 1) WHERE instr(`tenant_id`, '#') > 0;--> statement-breakpoint
DELETE FROM `project_tenants` WHERE instr(`tenant_id`, '#') > 0;--> statement-breakpoint
UPDATE OR IGNORE `project_models` SET `tenant` = substr(`tenant`, 1, instr(`tenant`, '#') - 1) WHERE instr(`tenant`, '#') > 0;--> statement-breakpoint
UPDATE OR IGNORE `project_groups` SET `tenant` = substr(`tenant`, 1, instr(`tenant`, '#') - 1) WHERE instr(`tenant`, '#') > 0;--> statement-breakpoint
UPDATE OR IGNORE `project_files` SET `tenant` = substr(`tenant`, 1, instr(`tenant`, '#') - 1) WHERE instr(`tenant`, '#') > 0;--> statement-breakpoint
UPDATE `seed_entries` SET `tenant` = substr(`tenant`, 1, instr(`tenant`, '#') - 1) WHERE instr(`tenant`, '#') > 0;
