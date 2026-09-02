import type {
  CmsGroup as BaseGroup,
  CmsModel as BaseModel,
  CmsModelDynamicZoneField,
  CmsModelField as BaseCmsModelField,
} from "@webiny/api-headless-cms/types/index.js";
import type {
  CreateFolderParams as AcoFolderCreateParams,
  Folder as AcoFolder,
} from "@webiny/api-aco/types.js";
import type { ICache } from "~/cache/index.js";
import type { CmsDynamicZoneTemplate } from "@webiny/api-headless-cms/types/fields/dynamicZoneField.js";

export type GenericRecordKey = string | number | symbol;
// eslint-disable-next-line
export type GenericRecord<K extends GenericRecordKey = GenericRecordKey, V = any> = Record<K, V>;

export interface IApplication {
  run(): Promise<void>;
}

/**
 * GraphQL
 */

export interface ApiCmsMeta {
  totalCount: number;
  hasMoreItems: boolean;
  cursor: string | null;
}

export interface ApiGraphQLSuccessResult<T> {
  data: T;
  meta?: ApiCmsMeta | null;
  error?: never;
  extensions?: GenericRecord[];
}

export interface ApiGraphQLErrorResult {
  data?: never | null;
  error: ApiError;
  extensions?: GenericRecord[];
}

export type ApiGraphQLResult<T> = ApiGraphQLSuccessResult<T> | ApiGraphQLErrorResult;

export interface IGraphQLApplicationGetResult<T> {
  (json: ApiGraphQLResultJson): ApiGraphQLResult<T>;
}

export interface ApiGraphQLResultJson {
  data: GenericRecord;
  meta?: ApiCmsMeta;
  errors?: GenericRecord[];
  extensions?: GenericRecord[];
}

export interface IGraphQLApplicationQueryParams<T> {
  query: string;
  path: `/cms/manage` | "/graphql";
  variables?: GenericRecord;
  getResult: IGraphQLApplicationGetResult<T>;
}

export interface IGraphQLApplicationMutationParams<T> {
  mutation: string;
  path: `/cms/manage` | "/graphql";
  variables: GenericRecord;
  getResult: IGraphQLApplicationGetResult<T>;
}

export interface IGraphQLApplicationMutationsParams<T> {
  mutation: string;
  path: `/cms/manage` | "/graphql";
  variables: GenericRecord[];
  getResult: IGraphQLApplicationGetResult<T>;
  atOnce?: number;
}

export interface IGraphQLApplication {
  setTenant(tenant: string): void;
  query<T>(params: IGraphQLApplicationQueryParams<T>): Promise<ApiGraphQLResult<T>>;
  mutation<T>(params: IGraphQLApplicationMutationParams<T>): Promise<ApiGraphQLResult<T>>;
  mutations<T>(params: IGraphQLApplicationMutationsParams<T>): Promise<ApiGraphQLResult<T>[]>;
}

/**
 * Group
 */
export interface IGroupApplication extends IApplication {
  getGroups(): ApiCmsGroup[];
}

/**
 * Model
 */
export interface IModelApplication extends IApplication {
  getModels(): ApiCmsModel[];
  getModel(id: string): ApiCmsModel;
  fetch(modelId: string): Promise<ApiCmsModel>;
}

/**
 * Entry
 */
export type IEntryRunnerResponse<T> = T & {
  total: number;
  errors: ApiError[];
};

export interface IEntryRunner<T = GenericRecord> {
  id: string;
  name: string;
  exec(): Promise<IEntryRunnerResponse<T>>;
}

export interface IEntryRunnerFactory<T = GenericRecord> {
  (app: IBaseApplication): IEntryRunner<T>;
}

export interface IEntryApplicationCreateViaGraphQLResponse<T> {
  entries: T[];
  errors: ApiError[];
}

export interface IEntryApplicationCreateViaGraphQLParamsOptions {
  skipValidators?: string[];
}

export interface IEntryApplicationCreateViaGraphQLParams {
  model: ApiCmsModel;
  variables: GenericRecord[];
  atOnce?: number;
  options?: IEntryApplicationCreateViaGraphQLParamsOptions;
}

export interface IEntryApplication extends IApplication {
  getEntries: <T>(name: string) => CmsEntry<T>[];
  createViaGraphQL<T>(
    params: IEntryApplicationCreateViaGraphQLParams,
  ): Promise<IEntryApplicationCreateViaGraphQLResponse<T>>;
}

/**
 * Folders
 */
export type { AcoFolderCreateParams };

export type { AcoFolder };

export interface IFolderApplicationCreateViaGraphQLResponse {
  folders: AcoFolder[];
  errors: ApiError[];
}

export type IFolderRunnerResponse = {
  folders: AcoFolder[];
  total: number;
  errors: ApiError[];
};

export interface IFolderRunner {
  id: string;
  name: string;
  exec(): Promise<IFolderRunnerResponse>;
}

export interface IFolderRunnerFactory {
  (app: IBaseApplication): IFolderRunner;
}

export interface IFolderApplication extends IApplication {
  getFolders: (app: string | null) => AcoFolder[];
  createViaGraphQL(
    variables: AcoFolderCreateParams[],
    atOnce?: number,
  ): Promise<IFolderApplicationCreateViaGraphQLResponse>;
}

/**
 * Fetcher
 */
export type IFetchEntriesApplication = IApplication;

/**
 * Base
 */
export interface IBaseApplication {
  run(): Promise<void>;
  getBooleanArg: (name: string, def: boolean) => boolean;
  getNumberArg: (name: string, def: number) => number;
  getStringArg: (name: string, def: string) => string;
  getApp: <T>(name: string) => T;
  graphql: IGraphQLApplication;
  cache: ICache;
}

export type ApiCmsGroup = Pick<BaseGroup, "id" | "name" | "slug">;

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

export type ApiCmsDynamicZoneTemplate = CmsDynamicZoneTemplate;

export interface ApiCmsModel extends Pick<
  BaseModel,
  "name" | "modelId" | "singularApiName" | "pluralApiName" | "tags"
> {
  fields: ApiCmsModelField[];
}

export interface ApiError {
  message: string;
  code: string;
  data?: GenericRecord | null;
}

/**
 * CMS entries
 *
 * @blog
 */
export interface CmsEntry<T> {
  id: string;
  entryId: string;
  values: T;
}

export interface ApiCmsCategoryValues {
  title: string;
}

export type ApiCmsCategory = CmsEntry<ApiCmsCategoryValues>;

export interface ApiCmsAuthorValues {
  name: string;
  dateOfBirth: string;
}

export type ApiCmsAuthor = CmsEntry<ApiCmsAuthorValues>;

export interface ApiCmsRef {
  id: string;
  modelId: string;
}

export interface ApiCmsArticleValues {
  title: string;
  description: string;
  body: GenericRecord;
  author: ApiCmsRef;
  categories: ApiCmsRef[];
}

export type ApiCmsArticle = CmsEntry<ApiCmsArticleValues>;

/**
 * @cars
 */
export interface ApiCmsSimpleCarMakeValues {
  name: string;
}
export type ApiCmsSimpleCarMake = CmsEntry<ApiCmsSimpleCarMakeValues>;

export interface ApiCmsSimpleCarModelValues {
  name: string;
  make: ApiCmsRef;
}

export type ApiCmsSimpleCarModel = CmsEntry<ApiCmsSimpleCarModelValues>;
