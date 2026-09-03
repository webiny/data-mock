import { makeAutoObservable, runInAction } from "mobx";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import { LoadProjectsUseCase } from "./useCases/LoadProjects/abstractions/LoadProjectsUseCase.js";
import { DeleteProjectUseCase } from "./useCases/DeleteProject/abstractions/DeleteProjectUseCase.js";
import { LoadTenantsUseCase } from "./useCases/LoadTenants/abstractions/LoadTenantsUseCase.js";
import { SyncTenantsUseCase } from "./useCases/SyncTenants/abstractions/SyncTenantsUseCase.js";
import { ProjectListPresenter as Abstraction } from "./abstractions/ProjectListPresenter.js";
import type { ProjectListVM } from "./abstractions/ProjectListPresenter.js";

class ProjectListPresenterImpl implements Abstraction.Interface {
  private _isLoading = false;
  private _syncingProjectIds = new Set<string>();
  private _removeProjectId: string | null = null;
  private _removeProjectName: string | null = null;

  public constructor(
    private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
    private readonly deleteProjectUseCase: DeleteProjectUseCase.Interface,
    private readonly loadTenantsUseCase: LoadTenantsUseCase.Interface,
    private readonly syncTenantsUseCase: SyncTenantsUseCase.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
    private readonly tenantsRepository: TenantsRepository.Interface,
  ) {
    makeAutoObservable(this);
  }

  public get vm(): ProjectListVM {
    const projects = this.projectsRepository.projects.map((p) => {
      const tenants = this.tenantsRepository.getTenantsByProjectId(p.id);
      return {
        id: p.id,
        name: p.name,
        apiUrl: p.apiUrl,
        tenant: p.tenant,
        webinyVersion: p.webinyVersion,
        tenants: tenants.map((t) => ({ tenantId: t.tenantId, name: t.name })),
        isSyncing: this._syncingProjectIds.has(p.id),
      };
    });

    return {
      projects,
      isLoading: this._isLoading,
      isEmpty: !this._isLoading && projects.length === 0,
      removeConfirmation: {
        isOpen: this._removeProjectId !== null,
        projectId: this._removeProjectId,
        projectName: this._removeProjectName,
      },
    };
  }

  public load = async (): Promise<void> => {
    this._isLoading = true;
    try {
      await this.loadProjectsUseCase.execute();
      const projects = this.projectsRepository.projects;
      await Promise.all(projects.map((p) => this.loadTenantsUseCase.execute(p.id)));
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
  };

  public remove = async (id: string): Promise<void> => {
    await this.deleteProjectUseCase.execute(id);
  };

  public confirmRemove = (projectId: string, projectName: string): void => {
    this._removeProjectId = projectId;
    this._removeProjectName = projectName;
  };

  public cancelRemove = (): void => {
    this._removeProjectId = null;
    this._removeProjectName = null;
  };

  public executeRemove = async (): Promise<void> => {
    const id = this._removeProjectId;
    if (!id) {
      return;
    }
    this._removeProjectId = null;
    this._removeProjectName = null;
    await this.deleteProjectUseCase.execute(id);
    await this.load();
  };

  public syncTenants = async (projectId: string): Promise<void> => {
    this._syncingProjectIds.add(projectId);
    try {
      await this.syncTenantsUseCase.execute(projectId);
    } finally {
      runInAction(() => {
        this._syncingProjectIds.delete(projectId);
      });
    }
  };
}

export const ProjectListPresenter = Abstraction.createImplementation({
  implementation: ProjectListPresenterImpl,
  dependencies: [
    LoadProjectsUseCase,
    DeleteProjectUseCase,
    LoadTenantsUseCase,
    SyncTenantsUseCase,
    ProjectsRepository,
    TenantsRepository,
  ],
});
