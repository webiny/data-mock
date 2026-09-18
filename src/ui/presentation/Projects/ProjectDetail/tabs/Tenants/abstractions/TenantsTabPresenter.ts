import { createAbstraction } from "@webiny/stdlib";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";

export interface ITenantVM {
  tenantId: string;
  name: string;
  discoveredAt: number;
}

export interface ITenantsTabVM {
  tenants: ITenantVM[];
  isLoading: boolean;
}

export interface ITenantsTabPresenter {
  readonly vm: ITenantsTabVM;
  /**
   * Reads the tab's data for the context it is mounted on, once. Called by the component when it
   * mounts and again whenever the context changes — the project detail shell resolves an
   * environment asynchronously, so the first call on a fresh page usually has none.
   */
  activate(context: ProjectDetailTabContext): Promise<void>;
  dispose(): void;
}

export const TenantsTabPresenter =
  createAbstraction<ITenantsTabPresenter>("Ui/TenantsTabPresenter");

export namespace TenantsTabPresenter {
  export type Interface = ITenantsTabPresenter;
  export type VM = ITenantsTabVM;
}
