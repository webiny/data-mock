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

export interface SeedJobConfig {
  models: Array<{ modelId: string; amount: number }>;
}

export type SeedJobStatus = "pending" | "running" | "completed" | "failed";

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
