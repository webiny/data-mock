import { createAbstraction } from "@webiny/stdlib";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";

export interface IModelVM {
  modelId: string;
  name: string;
  groupSlug: string;
  fieldCount: number;
  fields: unknown[];
  syncedAt: number | null;
}

export interface IGroupVM {
  slug: string;
  name: string;
  modelCount: number;
}

export interface IModelTenantVM {
  tenantId: string;
  name: string;
  modelCount: number;
}

export interface IModelsTabVM {
  /**
   * Every pulled tenant, whether or not it has models: one with none is a tenant with no key, or
   * one not pulled yet. Plus any tenant that has models but was not pulled.
   */
  tenants: IModelTenantVM[];
  selectedTenant: string;
  models: IModelVM[];
  groups: IGroupVM[];
  isLoading: boolean;
}

export interface IModelsTabPresenter {
  readonly vm: IModelsTabVM;
  /**
   * Reads the tab's data for the context it is mounted on, once. Called by the component when it
   * mounts and again whenever the context changes — the project detail shell resolves an
   * environment asynchronously, so the first call on a fresh page usually has none.
   */
  activate(context: ProjectDetailTabContext): Promise<void>;
  selectTenant(tenant: string): void;
  dispose(): void;
}

export const ModelsTabPresenter = createAbstraction<IModelsTabPresenter>("Ui/ModelsTabPresenter");

export namespace ModelsTabPresenter {
  export type Interface = IModelsTabPresenter;
  export type VM = IModelsTabVM;
}
