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
    singularApiName: text("singular_api_name").notNull(),
    pluralApiName: text("plural_api_name").notNull(),
    description: text("description"),
    fields: text("fields").notNull(),
    plugin: integer("plugin").notNull().default(0),
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

export const projectFiles = sqliteTable(
  "project_files",
  {
    id: text("id").primaryKey().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tenant: text("tenant").notNull(),
    fileKey: text("file_key").notNull(),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(),
    fileSize: integer("file_size"),
    uploadedAt: integer("uploaded_at").notNull(),
  },
  (table) => [uniqueIndex("project_file_unique").on(table.projectId, table.fileKey)],
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

export const syncLogs = sqliteTable("sync_logs", {
  id: text("id").primaryKey().notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  status: text("status").notNull(),
  message: text("message").notNull(),
  request: text("request"),
  response: text("response"),
  createdAt: integer("created_at").notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey().notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  status: text("status").notNull(),
  config: text("config"),
  logs: text("logs"),
  progress: integer("progress"),
  progressLabel: text("progress_label"),
  parentJobId: text("parent_job_id"),
  startedAt: integer("started_at"),
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull(),
});

export const seedEntries = sqliteTable("seed_entries", {
  id: text("id").primaryKey().notNull(),
  jobId: text("job_id").references(() => seedJobs.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  tenant: text("tenant").notNull(),
  modelId: text("model_id").notNull(),
  entryId: text("entry_id").notNull(),
  entryData: text("entry_data").notNull(),
  requestData: text("request_data"),
  responseData: text("response_data"),
  httpStatus: integer("http_status"),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: integer("created_at").notNull(),
});
