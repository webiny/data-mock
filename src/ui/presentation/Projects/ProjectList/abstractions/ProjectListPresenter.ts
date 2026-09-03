import { createAbstraction } from "@webiny/stdlib";

export interface ProjectTenantVM {
  tenantId: string;
  name: string;
}

export interface ProjectItemVM {
  id: string;
  name: string;
  apiUrl: string;
  tenant: string;
  webinyVersion: string;
  tenants: ProjectTenantVM[];
  isSyncing: boolean;
}

export interface RemoveConfirmationVM {
  isOpen: boolean;
  projectId: string | null;
  projectName: string | null;
}

export interface ProjectListVM {
  projects: ProjectItemVM[];
  isLoading: boolean;
  isEmpty: boolean;
  removeConfirmation: RemoveConfirmationVM;
}

export interface IProjectListPresenter {
  readonly vm: ProjectListVM;
  load(): Promise<void>;
  remove(id: string): Promise<void>;
  confirmRemove(projectId: string, projectName: string): void;
  cancelRemove(): void;
  executeRemove(): Promise<void>;
  syncTenants(projectId: string): Promise<void>;
}

export const ProjectListPresenter =
  createAbstraction<IProjectListPresenter>("Ui/ProjectListPresenter");

export namespace ProjectListPresenter {
  export type Interface = IProjectListPresenter;
  export type ViewModel = ProjectListVM;
}
