import { ApiCmsModelField } from "~/shared/types.js";

export interface ICreateFieldGraphQlDefinition {
  (field: ApiCmsModelField): string;
}

export interface ICreateFieldParams {
  type: string;
  graphQlDefinition: ICreateFieldGraphQlDefinition;
}

export const createField = (params: ICreateFieldParams): (() => ICreateFieldParams) => {
  return () => params;
};
