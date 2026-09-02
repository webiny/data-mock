import type {
  CmsGroup,
  CmsModel as BaseModel,
  CmsModelField as BaseCmsModelField,
} from "@webiny/api-headless-cms/types/index.js";

export type CmsModelGroup = Pick<CmsGroup, "slug">;

export type CmsModelField = Pick<
  BaseCmsModelField,
  | "id"
  | "fieldId"
  | "label"
  | "type"
  | "list"
  | "validation"
  | "listValidation"
  | "settings"
  | "renderer"
>;

export interface CmsModel extends Pick<
  BaseModel,
  "modelId" | "name" | "description" | "layout" | "singularApiName" | "pluralApiName"
> {
  fields: CmsModelField[];
  group: string;
}
