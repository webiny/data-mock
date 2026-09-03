import type {
  CmsModel as BaseCmsModel,
  CmsModelField as BaseCmsModelField,
  CmsModelDynamicZoneField,
} from "@webiny/api-headless-cms/types/index.js";

export type GenericRecordKey = string | number | symbol;
// eslint-disable-next-line
export type GenericRecord<K extends GenericRecordKey = GenericRecordKey, V = any> = Record<K, V>;

export type ApiCmsModelField = Pick<
  BaseCmsModelField,
  | "id"
  | "fieldId"
  | "storageId"
  | "type"
  | "list"
  | "settings"
  | "predefinedValues"
  | "validation"
  | "listValidation"
>;

export type ApiCmsModelDynamicZoneField = Pick<
  CmsModelDynamicZoneField,
  | "id"
  | "fieldId"
  | "storageId"
  | "type"
  | "list"
  | "settings"
  | "predefinedValues"
  | "validation"
  | "listValidation"
>;

export interface ApiCmsModel extends Pick<
  BaseCmsModel,
  "name" | "modelId" | "singularApiName" | "pluralApiName" | "tags"
> {
  fields: ApiCmsModelField[];
}

export interface CmsEntry<T> {
  id: string;
  entryId: string;
  values: T;
}

export interface Project {
  id: string;
  name: string;
  apiUrl: string;
  apiToken: string;
  tenant: string;
  webinyVersion: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectTenant {
  id: string;
  projectId: string;
  tenantId: string;
  name: string;
  discoveredAt: number;
}

export interface ProjectGroup {
  id: string;
  projectId: string;
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
  groupSlug: string;
  modelId: string;
  name: string;
  description: string | null;
  fields: ApiCmsModelField[];
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
  publishStrategy?: PublishStrategy | undefined;
  publishPercent?: number | undefined;
  includeUnpublish?: boolean | undefined;
}

export type SeedJobStatus = "pending" | "running" | "completed" | "failed" | "dry-run";

export interface SeedJob {
  id: string;
  projectId: string;
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

export type SeedEntryStatus = "created" | "failed" | "dry-run";

export interface OperationLog {
  name: string;
  url: string;
  query: string;
  httpStatus: number;
  response: unknown;
}

export type SyncLogType = "tenants" | "models";
export type SyncLogStatus = "success" | "error";

export interface SyncLog {
  id: string;
  projectId: string;
  type: SyncLogType;
  status: SyncLogStatus;
  message: string;
  response: unknown;
  createdAt: number;
}

export interface SeedEntry {
  id: string;
  jobId: string;
  projectId: string;
  tenant: string;
  modelId: string;
  entryId: string;
  entryData: Record<string, unknown>;
  responseData: Record<string, unknown> | null;
  httpStatus: number | null;
  status: SeedEntryStatus;
  error: string | null;
  createdAt: number;
}
