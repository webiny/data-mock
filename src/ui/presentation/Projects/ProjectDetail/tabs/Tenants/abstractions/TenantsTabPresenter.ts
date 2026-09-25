import { createAbstraction } from "@webiny/stdlib";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";

export interface ITenantVM {
  tenantId: string;
  name: string;
  /** The tenant's own token, or null when it has none. */
  apiToken: string | null;
  /**
   * Which key the tenant talks with. "environment" is the environment's main key, which only the
   * default (root) tenant may use; a tenant on "none" is skipped by Pull Models and cannot be
   * seeded.
   */
  keySource: "own" | "environment" | "none";
  discoveredAt: number;
}

export interface ITenantsTabVM {
  tenants: ITenantVM[];
  /** The tenant whose token is being edited, or null when the dialog is shut. */
  editingTenant: ITenantVM | null;
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
  openEditToken(tenantId: string): void;
  closeEditToken(): void;
  /** An empty token removes the tenant's own. Resolves true once saved. */
  submitToken(apiToken: string): Promise<boolean>;
  dispose(): void;
}

export const TenantsTabPresenter =
  createAbstraction<ITenantsTabPresenter>("Ui/TenantsTabPresenter");

export namespace TenantsTabPresenter {
  export type Interface = ITenantsTabPresenter;
  export type VM = ITenantsTabVM;
}
