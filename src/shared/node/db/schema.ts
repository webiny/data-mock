import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  apiUrl: text("api_url").notNull(),
  apiToken: text("api_token").notNull(),
  tenant: text("tenant").default("root").notNull(),
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
