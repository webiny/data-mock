import type {
  CmsContentModelField,
  CmsContentModel,
} from "~/shared/node/graphql/operations/base/listContentModels.js";

export type ApiCmsModelField = CmsContentModelField;
export type ApiCmsModel = CmsContentModel;
export type ApiCmsModelDynamicZoneField = CmsContentModelField;

export type GenericRecordKey = string | number | symbol;
// eslint-disable-next-line
export type GenericRecord<K extends GenericRecordKey = GenericRecordKey, V = any> = Record<K, V>;

export interface CmsEntry<T> {
  id: string;
  entryId: string;
  values: T;
}

/**
 * A Webiny system. `rootPath` set = a checkout on disk that can be deployed, destroyed and synced;
 * null = a remote-only connection that can still be seeded.
 *
 * `webinyVersion` is detected and display-only — legitimately null for a framework workspace root.
 * `operationsVersion` drives the GraphQL operation registry and is never null.
 */
export interface Project {
  id: string;
  name: string;
  rootPath: string | null;
  webinyVersion: string | null;
  versionSource: VersionSource | null;
  versionMajor: number | null;
  operationsVersion: string;
  pulumiBackend: string | null;
  awsProfile: string | null;
  awsRegion: string | null;
  lastSyncedAt: number | null;
  lastSyncStatus: SyncStatus | null;
  archivedAt: number | null;
  /**
   * True when `.projects.json` names this project. Derived from that file on every read, not
   * stored: the seed file recreates the project on each boot, so it cannot be deleted while the
   * entry is there, and removing the entry makes it deletable without a restart.
   */
  seeded: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Addresses one environment. Passed as an object rather than two positional strings so a call site
 * cannot silently transpose the ids — they are both opaque generated ids of the same shape.
 */
export interface EnvironmentRef {
  projectId: string;
  environmentId: string;
}

/** Which rung of the version fallback chain answered. */
export type VersionSource =
  | "env-var"
  | "package-json"
  | "node-modules"
  | "template-field"
  | "workspace-root";

export type SyncStatus = "success" | "partial" | "error" | "stale-possible";

/** How a stack file read resolved. "unknown" must never overwrite good data. */
export type StackReadState = "deployed" | "not-deployed" | "unknown";

/**
 * One Pulumi stack name of a project — `<env>` or `<env>___<variant>`.
 *
 * `deployed` means ANY app is deployed. `apiUrl` / `adminUrl` are per-app facts and stay null when
 * their app is not deployed, so a partially deployed environment has `deployed: true` with a null
 * `apiUrl` and cannot be seeded.
 */
export interface ProjectEnvironment {
  id: string;
  projectId: string;
  env: string;
  variant: string;
  region: string | null;
  deployed: boolean;
  apiUrl: string | null;
  adminUrl: string | null;
  apiToken: string | null;
  tenant: string;
  lastSyncedAt: number | null;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * What a hard delete would destroy. Every child table cascades from `projects` and from
 * `project_environments`, so these counts are the rows that disappear with the parent — they are
 * shown on the confirmation before a purge, and are the reason the default delete only archives.
 *
 * Environment scope reports `environments: 0` and `seedTemplates: 0`: an environment is not a
 * parent of other environments, and seed templates are project-scoped and survive it.
 */
export interface DeletionImpact {
  environments: number;
  stacks: number;
  tenants: number;
  groups: number;
  models: number;
  files: number;
  seedJobs: number;
  seedEntries: number;
  syncLogs: number;
  jobs: number;
  seedTemplates: number;
}

/** One app within an environment. `app` is free text — whatever was found on disk. */
export interface ProjectStack {
  id: string;
  environmentId: string;
  app: string;
  deployed: boolean;
  resourceCount: number | null;
  stackOutput: GenericRecord<string, unknown> | null;
  readState: StackReadState;
  syncedAt: number | null;
}

/**
 * One subdirectory offered by the directory browser. `readable` is false when the directory exists
 * but cannot be opened — it is still listed, because hiding it would look like it is not there.
 */
export interface DirectoryEntry {
  name: string;
  path: string;
  isWebinyProject: boolean;
  readable: boolean;
}

export interface BrowseResult {
  /** The resolved, real path that was listed. */
  path: string;
  /** Null at the filesystem root, where there is nowhere to go up to. */
  parentPath: string | null;
  isWebinyProject: boolean;
  entries: DirectoryEntry[];
}

/** A Webiny checkout found by a scan. `registered` marks one that is already a project. */
export interface ProjectCandidate {
  rootPath: string;
  name: string;
  versionMajor: number | null;
  webinyVersion: string | null;
  /** A project already points at this exact checkout, so adding it again would duplicate it. */
  registered: boolean;
  /**
   * A project of this name exists but names no checkout — almost always this same system, seeded
   * from `.projects.json` before that file could carry a `rootPath`. Offered as attach rather than
   * add: creating a second project here is how you end up with two rows for one system.
   */
  attachableProjectId: string | null;
}

export interface ScanError {
  path: string;
  message: string;
}

/**
 * Unreadable roots are reported alongside the candidates rather than dropped: a scan that silently
 * skipped half the tree would read as "nothing is there".
 */
export interface ScanResult {
  candidates: ProjectCandidate[];
  errors: ScanError[];
  /** How many roots were walked. Zero means none are configured, not that nothing was found. */
  rootsScanned: number;
}

export interface ScanRoot {
  id: string;
  path: string;
  createdAt: number;
}

export interface ProjectTenant {
  id: string;
  projectId: string;
  environmentId: string;
  tenantId: string;
  name: string;
  /** Decrypted. Null when the tenant has no token of its own. */
  apiToken: string | null;
  discoveredAt: number;
}

export interface ProjectGroup {
  id: string;
  projectId: string;
  environmentId: string;
  tenant: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  remoteId: string | null;
  syncedAt: number | null;
  createdAt: number;
}

export interface ProjectModel {
  id: string;
  projectId: string;
  environmentId: string;
  tenant: string;
  groupSlug: string;
  modelId: string;
  name: string;
  singularApiName: string;
  pluralApiName: string;
  description: string | null;
  fields: ApiCmsModelField[];
  plugin: boolean;
  remoteId: string | null;
  syncedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SeedTemplateConfig {
  tenant: string;
  models: Array<{ modelId: string; amount: number }>;
}

export interface SeedTemplate {
  id: string;
  projectId: string;
  name: string;
  config: SeedTemplateConfig;
  createdAt: number;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  environmentId: string;
  tenant: string;
  fileKey: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  uploadedAt: number;
}

export type Revisions = number | { min: number; max: number };
export type PublishStrategy = "none" | "all" | "random" | "first" | "last";

export interface SeedModelConfig {
  modelId: string;
  amount: number;
  revisions?: Revisions | undefined;
}

export interface SeedJobConfig {
  models: SeedModelConfig[];
  /**
   * Which tenant the run seeded. Optional because rows written before resuming existed do not
   * carry it — a resume falls back to the tenant on the entries the run already created.
   */
  tenant?: string | undefined;
  batchSize?: number | undefined;
  publishStrategy?: PublishStrategy | undefined;
  publishPercent?: number | undefined;
  includeUnpublish?: boolean | undefined;
}

export type SeedJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "dry-run";

export interface SeedJob {
  id: string;
  projectId: string;
  environmentId: string;
  status: SeedJobStatus;
  config: SeedJobConfig;
  result: SeedJobResult | null;
  startedAt: number | null;
  finishedAt: number | null;
  createdAt: number;
}

export interface SeedJobResult {
  created: number;
  errors: Array<{ message: string; code: string }>;
}

export type SeedEntryStatus = "created" | "failed" | "dry-run" | "imported" | "deleted";

export interface Job {
  id: string;
  projectId: string | null;
  environmentId: string | null;
  type: string;
  status: string;
  config: unknown;
  logs: string | null;
  /** The job's own answer, for a job that produces one. Null for jobs whose effect is the write. */
  result: unknown;
  progress: number | null;
  progressLabel: string | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
}

export interface OperationLog {
  name: string;
  url: string;
  query: string;
  httpStatus: number;
  response: unknown;
}

export type SyncLogType = "tenants" | "models" | "upload-file" | "pull-files";
export type SyncLogStatus = "success" | "error";

export interface SyncLog {
  id: string;
  projectId: string;
  environmentId: string;
  type: SyncLogType;
  status: SyncLogStatus;
  message: string;
  request: unknown;
  response: unknown;
  createdAt: number;
}

export interface SeedEntry {
  id: string;
  jobId: string | null;
  projectId: string;
  environmentId: string;
  tenant: string;
  modelId: string;
  entryId: string;
  entryData: Record<string, unknown>;
  requestData: Record<string, unknown> | null;
  responseData: string | null;
  httpStatus: number | null;
  status: SeedEntryStatus;
  error: string | null;
  createdAt: number;
}
