import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  apiUrl: text("api_url").notNull(),
  apiToken: text("api_token").notNull(),
  tenant: text("tenant").default("root").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

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
