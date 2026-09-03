import { createAbstraction } from "@webiny/stdlib";

export interface ProjectListVM {
  projects: Array<{ id: string; name: string; apiUrl: string; tenant: string }>;
  isLoading: boolean;
  isEmpty: boolean;
}

export interface IProjectListPresenter {
  readonly vm: ProjectListVM;
  load(): Promise<void>;
  remove(id: string): Promise<void>;
}

export const ProjectListPresenter =
  createAbstraction<IProjectListPresenter>("Ui/ProjectListPresenter");

export namespace ProjectListPresenter {
  export type Interface = IProjectListPresenter;
  export type ViewModel = ProjectListVM;
}
