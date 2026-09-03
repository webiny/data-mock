import { createAbstraction } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";

export interface IProjectsRepository {
  readonly projects: Project[];
  setProjects(projects: Project[]): void;
  addProject(project: Project): void;
  removeProject(id: string): void;
}

export const ProjectsRepository = createAbstraction<IProjectsRepository>("Ui/ProjectsRepository");

export namespace ProjectsRepository {
  export type Interface = IProjectsRepository;
}
