import { createAbstraction } from "@webiny/stdlib";
import type { SeedTemplateConfig, SeedEntryStatus, Job } from "~/shared/types.js";

export interface IProjectVM {
  id: string;
  name: string;
  apiUrl: string;
  apiToken: string;
  webinyVersion: string;
  tenant: string;
  createdAt: number;
}

export interface ITenantVM {
  tenantId: string;
  name: string;
  discoveredAt: number;
}

export interface IGroupVM {
  slug: string;
  name: string;
  modelCount: number;
}

export interface IModelVM {
  modelId: string;
  name: string;
  groupSlug: string;
  fieldCount: number;
  fields: unknown[];
  syncedAt: number | null;
}

export interface ISeedJobVM {
  id: string;
  status: string;
  modelCount: number;
  entriesCreated: number;
  errorCount: number;
  createdAt: number;
}

export interface ITemplateVM {
  id: string;
  name: string;
  config: SeedTemplateConfig;
}

export interface IFileVM {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  tenant: string;
  uploadedAt: number;
}

export interface IFileBadgeVM {
  label: string;
  color: string;
}

export interface IMergedFileVM {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  source: "project" | "global";
  thumbnailUrl: string;
  badges: IFileBadgeVM[];
}

export interface IEntryVM {
  id: string;
  modelId: string;
  tenant: string;
  status: SeedEntryStatus;
  entryId: string;
  entryData: Record<string, unknown>;
  requestData: Record<string, unknown> | null;
  responseData: string | null;
  error: string | null;
  createdAt: number;
}

export interface ISyncLogVM {
  id: string;
  type: "tenants" | "models" | "upload-file" | "pull-files";
  status: "success" | "error";
  message: string;
  request: unknown;
  response: unknown;
  createdAt: number;
}

export interface IEditProjectInput {
  name?: string;
  apiUrl?: string;
  apiToken?: string;
  tenant?: string;
  webinyVersion?: string;
}

export interface IProjectDetailVM {
  project: IProjectVM | null;
  tenants: ITenantVM[];
  groups: IGroupVM[];
  models: IModelVM[];
  seedJobs: ISeedJobVM[];
  templates: ITemplateVM[];
  files: IFileVM[];
  mergedFiles: IMergedFileVM[];
  entries: IEntryVM[];
  entriesTotalCount: number;
  entriesPage: number;
  entriesJobFilter: string | null;
  entriesModelFilter: string | null;
  entriesTenantFilter: string | null;
  entriesStatusFilter: string | null;
  syncLog: ISyncLogVM[];
  syncLogsTotalCount: number;
  syncLogsPage: number;
  syncLogsTypeFilter: string | null;
  syncLogsStatusFilter: string | null;
  jobs: Job[];
  jobsTotalCount: number;
  jobsPage: number;
  jobsTypeFilter: string | null;
  jobsStatusFilter: string | null;
  projectHealth: "unknown" | "checking" | "reachable" | "unreachable";
  projectHealthError: string | null;
  isLoading: boolean;
  isSyncingTenants: boolean;
  isSyncingModels: boolean;
  isImporting: boolean;
  isClearingEntries: boolean;
  isCleaningUp: boolean;
  isUploadingGlobal: boolean;
  isPullingFiles: boolean;
  showEditDialog: boolean;
  showCleanupDialog: boolean;
}

export interface IProjectDetailPresenter {
  readonly vm: IProjectDetailVM;
  load(projectId: string): Promise<void>;
  activateView(view: string): Promise<void>;
  checkHealth(): Promise<void>;
  loadTemplate(templateId: string): void;
  deleteTemplate(templateId: string): Promise<void>;
  pullTenants(): Promise<void>;
  pullModels(): Promise<void>;
  openEditDialog(): void;
  closeEditDialog(): void;
  submitEdit(input: IEditProjectInput): Promise<boolean>;
  loadEntriesPage(page: number): void;
  viewJobEntries(jobId: string): void;
  setEntriesFilter(key: string, value: string | null): void;
  clearEntriesFilter(): void;
  clearEntries(): Promise<void>;
  deleteFile(fileId: string): Promise<void>;
  uploadFilesToProject(files: File[]): Promise<void>;
  uploadAllGlobalImages(): Promise<void>;
  uploadSelectedGlobalImages(fileNames: string[]): Promise<void>;
  deleteSyncLog(logId: string): Promise<void>;
  importEntries(tenant: string, modelIds: string[]): Promise<void>;
  openCleanupDialog(): void;
  closeCleanupDialog(): void;
  confirmCleanup(): Promise<void>;
  loadJobsPage(page: number): void;
  setJobsFilter(key: string, value: string | null): void;
  clearJobsFilter(): void;
  loadSyncLogsPage(page: number): void;
  setSyncLogsFilter(key: string, value: string | null): void;
  clearSyncLogsFilter(): void;
  pullFiles(): Promise<void>;
  cancelJob(jobId: string): Promise<void>;
  dispose(): void;
}

export const ProjectDetailPresenter = createAbstraction<IProjectDetailPresenter>(
  "Ui/ProjectDetailPresenter",
);

export namespace ProjectDetailPresenter {
  export type Interface = IProjectDetailPresenter;
  export type VM = IProjectDetailVM;
}
