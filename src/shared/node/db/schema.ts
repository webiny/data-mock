import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  apiUrl: text("api_url").notNull(),
  apiToken: text("api_token").notNull(),
  tenant: text("tenant").default("root").notNull(),
  webinyVersion: text("webiny_version").default("6.0.0").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const projectTenants = sqliteTable(
  "project_tenants",
  {
    id: text("id").primaryKey().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    discoveredAt: integer("discovered_at").notNull(),
  },
  (table) => [uniqueIndex("project_tenant_unique").on(table.projectId, table.tenantId)],
);

export const projectGroups = sqliteTable(
  "project_groups",
  {
    id: text("id").primaryKey().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    remoteId: text("remote_id"),
    syncedAt: integer("synced_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("project_group_unique").on(table.projectId, table.slug)],
);

export const projectModels = sqliteTable(
  "project_models",
  {
    id: text("id").primaryKey().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    groupSlug: text("group_slug").notNull(),
    modelId: text("model_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    fields: text("fields").notNull(),
    remoteId: text("remote_id"),
    syncedAt: integer("synced_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("project_model_unique").on(table.projectId, table.modelId)],
);

export const seedTemplates = sqliteTable(
  "seed_templates",
  {
    id: text("id").primaryKey().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    config: text("config").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("seed_template_unique").on(table.projectId, table.name)],
);

export const seedJobs = sqliteTable("seed_jobs", {
  id: text("id").primaryKey().notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  config: text("config").notNull(),
  result: text("result"),
  startedAt: integer("started_at"),
  finishedAt: integer("finished_at"),
  createdAt: integer("created_at").notNull(),
});
