import { makeAutoObservable } from "mobx";
import type { Project } from "~/shared/types.js";
import { ProjectsRepository as Abstraction } from "./abstractions/ProjectsRepository.js";

class ProjectsRepositoryImpl implements Abstraction.Interface {
  private _projects: Project[] = [];

  public constructor() {
    makeAutoObservable(this);
  }

  public get projects(): Project[] {
    return this._projects;
  }

  public setProjects(projects: Project[]): void {
    this._projects = projects;
  }

  public addProject(project: Project): void {
    this._projects.push(project);
  }

  public updateProject(project: Project): void {
    const index = this._projects.findIndex((p) => p.id === project.id);
    if (index !== -1) {
      this._projects[index] = project;
    }
  }

  public removeProject(id: string): void {
    this._projects = this._projects.filter((p) => p.id !== id);
  }
}

export const ProjectsRepository = Abstraction.createImplementation({
  implementation: ProjectsRepositoryImpl,
  dependencies: [],
});
