import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * A project is a Webiny system. When `rootPath` is set it is a checkout on disk that can be
 * deployed, destroyed and synced. When `rootPath` is null it is a remote-only connection that can
 * still be seeded.
 *
 * `webinyVersion` is the DETECTED version and is display-only — it can legitimately be null for a
 * framework workspace root. `operationsVersion` is what drives the GraphQL operation registry and
 * must never be null (and never "0.0.0", which resolves to the lowest registered operation).
 */
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  rootPath: text("root_path"),
  webinyVersion: text("webiny_version"),
  versionSource: text("version_source"),
  versionMajor: integer("version_major"),
  operationsVersion: text("operations_version").default("6.0.0").notNull(),
  pulumiBackend: text("pulumi_backend"),
  awsProfile: text("aws_profile"),
  awsRegion: text("aws_region"),
  lastSyncedAt: integer("last_synced_at"),
  lastSyncStatus: text("last_sync_status"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * One deployed (or declared) environment of a project — a Pulumi stack name, which is
 * `<env>` or `<env>___<variant>`.
 *
 * `variant` is "" rather than NULL on purpose: SQLite treats NULLs as distinct in unique indexes,
 * so a nullable variant would let duplicate (project, env) rows through.
 *
 * `deployed` means ANY app is deployed. `apiUrl` / `adminUrl` are per-app facts and stay null when
 * their app is not deployed, so a partially deployed environment has `deployed = 1` with a null
 * `apiUrl` — that environment cannot be seeded.
 */
export const projectEnvironments = sqliteTable(
  "project_environments",
  {
    id: text("id").primaryKey().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    env: text("env").notNull(),
    variant: text("variant").default("").notNull(),
    region: text("region"),
    deployed: integer("deployed").default(0).notNull(),
    apiUrl: text("api_url"),
    adminUrl: text("admin_url"),
    apiToken: text("api_token"),
    tenant: text("tenant").default("root").notNull(),
    lastSyncedAt: integer("last_synced_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_environment_unique").on(table.projectId, table.env, table.variant),
  ],
);

/**
 * One Pulumi stack — an app within an environment. `app` is free text because it records whatever
 * is found on disk (core, api, admin, website, blueGreen, sync, …); the deployable set offered in
 * the UI is a per-version concern, not a storage constraint.
 *
 * `readState` distinguishes a destroyed stack from one we could not read. On "unknown" the sync
 * must not overwrite a previously-good `stackOutput`.
 */
export const projectStacks = sqliteTable(
  "project_stacks",
  {
    id: text("id").primaryKey().notNull(),
    environmentId: text("environment_id")
      .notNull()
      .references(() => projectEnvironments.id, { onDelete: "cascade" }),
    app: text("app").notNull(),
    deployed: integer("deployed").default(0).notNull(),
    resourceCount: integer("resource_count"),
    stackOutput: text("stack_output"),
    readState: text("read_state").notNull(),
    syncedAt: integer("synced_at"),
  },
  (table) => [uniqueIndex("project_stack_unique").on(table.environmentId, table.app)],
);

/**
 * Directories scanned for Webiny projects.
 */
export const scanRoots = sqliteTable("scan_roots", {
  id: text("id").primaryKey().notNull(),
  path: text("path").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const projectTenants = sqliteTable(
  "project_tenants",
  {
    id: text("id").primaryKey().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    environmentId: text("environment_id")
      .notNull()
      .references(() => projectEnvironments.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    discoveredAt: integer("discovered_at").notNull(),
  },
  (table) => [uniqueIndex("project_tenant_unique").on(table.environmentId, table.tenantId)],
);

export const projectGroups = sqliteTable(
  "project_groups",
  {
    id: text("id").primaryKey().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    environmentId: text("environment_id")
      .notNull()
      .references(() => projectEnvironments.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    remoteId: text("remote_id"),
    syncedAt: integer("synced_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("project_group_unique").on(table.environmentId, table.slug)],
);

export const projectModels = sqliteTable(
  "project_models",
  {
    id: text("id").primaryKey().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    environmentId: text("environment_id")
      .notNull()
      .references(() => projectEnvironments.id, { onDelete: "cascade" }),
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
  (table) => [uniqueIndex("project_model_unique").on(table.environmentId, table.modelId)],
);

/**
 * Seed templates stay project-scoped: a saved seed configuration is meant to be reused across
 * environments, so scoping it to one would defeat its purpose.
 */
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
    environmentId: text("environment_id")
      .notNull()
      .references(() => projectEnvironments.id, { onDelete: "cascade" }),
    tenant: text("tenant").notNull(),
    fileKey: text("file_key").notNull(),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(),
    fileSize: integer("file_size"),
    uploadedAt: integer("uploaded_at").notNull(),
  },
  (table) => [uniqueIndex("project_file_unique").on(table.environmentId, table.fileKey)],
);

export const seedJobs = sqliteTable("seed_jobs", {
  id: text("id").primaryKey().notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  environmentId: text("environment_id")
    .notNull()
    .references(() => projectEnvironments.id, { onDelete: "cascade" }),
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
  environmentId: text("environment_id")
    .notNull()
    .references(() => projectEnvironments.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  status: text("status").notNull(),
  message: text("message").notNull(),
  request: text("request"),
  response: text("response"),
  createdAt: integer("created_at").notNull(),
});

/**
 * `projectId` is nullable for global jobs (e.g. picsum pull). `environmentId` is nullable because
 * jobs come in three scopes: global (neither set), project-scoped (sync-system), and
 * environment-scoped (seed, deploy, destroy).
 */
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey().notNull(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  environmentId: text("environment_id").references(() => projectEnvironments.id, {
    onDelete: "cascade",
  }),
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
  environmentId: text("environment_id")
    .notNull()
    .references(() => projectEnvironments.id, { onDelete: "cascade" }),
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
