import { makeAutoObservable, runInAction } from "mobx";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { LoadProjectsUseCase } from "./useCases/LoadProjects/abstractions/LoadProjectsUseCase.js";
import { DeleteProjectUseCase } from "./useCases/DeleteProject/abstractions/DeleteProjectUseCase.js";
import { ProjectListPresenter as Abstraction } from "./abstractions/ProjectListPresenter.js";
import type { ProjectListVM } from "./abstractions/ProjectListPresenter.js";

class ProjectListPresenterImpl implements Abstraction.Interface {
  private _isLoading = false;

  public constructor(
    private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
    private readonly deleteProjectUseCase: DeleteProjectUseCase.Interface,
    private readonly repository: ProjectsRepository.Interface,
  ) {
    makeAutoObservable(this);
  }

  public get vm(): ProjectListVM {
    const projects = this.repository.projects.map((p) => ({
      id: p.id,
      name: p.name,
      apiUrl: p.apiUrl,
      tenant: p.tenant,
    }));

    return {
      projects,
      isLoading: this._isLoading,
      isEmpty: !this._isLoading && projects.length === 0,
    };
  }

  public load = async (): Promise<void> => {
    this._isLoading = true;
    try {
      await this.loadProjectsUseCase.execute();
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
  };

  public remove = async (id: string): Promise<void> => {
    await this.deleteProjectUseCase.execute(id);
  };
}

export const ProjectListPresenter = Abstraction.createImplementation({
  implementation: ProjectListPresenterImpl,
  dependencies: [LoadProjectsUseCase, DeleteProjectUseCase, ProjectsRepository],
});
