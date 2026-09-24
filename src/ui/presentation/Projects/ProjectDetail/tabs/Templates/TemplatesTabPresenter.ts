import { makeAutoObservable, runInAction } from "mobx";
import { TemplatesGateway } from "~/ui/features/templates/abstractions/TemplatesGateway.js";
import { TemplatesRepository } from "~/ui/features/templates/abstractions/TemplatesRepository.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { navigate } from "~/ui/features/router/Router.js";
import { AppRoutes } from "~/ui/features/router/routePaths.js";
import type { ProjectDetailTabContext } from "../abstractions/ProjectDetailTabContext.js";
import { DeleteTemplateUseCase } from "./useCases/DeleteTemplate/abstractions/DeleteTemplateUseCase.js";
import { TemplatesTabPresenter as Abstraction } from "./abstractions/TemplatesTabPresenter.js";
import type { ITemplatesTabVM } from "./abstractions/TemplatesTabPresenter.js";

/** The dataset this tab owns, as the job descriptors name it. */
const DATASET = "templates";

class TemplatesTabPresenterImpl implements Abstraction.Interface {
  private _context: ProjectDetailTabContext | null = null;
  private _loadedProjectId: string | null = null;
  private _isLoading = false;

  public constructor(
    private readonly templatesGateway: TemplatesGateway.Interface,
    private readonly templatesRepository: TemplatesRepository.Interface,
    private readonly deleteTemplateUseCase: DeleteTemplateUseCase.Interface,
    private readonly notifications: NotificationService.Interface,
  ) {
    makeAutoObservable(this);
  }

  public get vm(): ITemplatesTabVM {
    const projectId = this._context?.projectId ?? null;
    const templates = projectId ? this.templatesRepository.getTemplatesByProjectId(projectId) : [];

    return {
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        config: template.config,
      })),
      isLoading: this._isLoading,
    };
  }

  /**
   * Templates are project-scoped, so — unlike an environment-scoped tab — this reads as soon as a
   * project id is known, without waiting for the shell to resolve an environment.
   */
  public activate = async (context: ProjectDetailTabContext): Promise<void> => {
    runInAction(() => {
      this._context = context;
    });
    if (this._loadedProjectId === context.projectId || this._isLoading) {
      return;
    }
    await this.read(context.projectId);
  };

  public loadTemplate = (_templateId: string): void => {
    const context = this._context;
    if (context === null) {
      return;
    }
    navigate(AppRoutes.seedConfig(context.projectId, context.envName ?? ""));
  };

  public deleteTemplate = async (templateId: string): Promise<void> => {
    const ref = this._context?.ref ?? null;
    if (ref === null) {
      return;
    }
    const result = await this.deleteTemplateUseCase.execute({
      projectId: ref.projectId,
      templateId,
    });
    if (result.isFail()) {
      this.notifications.error(`Failed to delete template: ${result.error.message}`);
      return;
    }
    this.notifications.success("Template deleted.");
  };

  /**
   * Nothing to unsubscribe from. Unlike every other tab, no job writes templates — they are
   * written by the seed config screen — so this one has nothing to invalidate it. `dispose` stays
   * because the component calls it on unmount like any other tab's.
   */
  public dispose = (): void => {};

  /**
   * A failed read is never marked loaded, so the next activation asks again rather than leaving
   * the tab blank for the rest of the session.
   */
  private read = async (projectId: string): Promise<void> => {
    runInAction(() => {
      this._isLoading = true;
    });
    try {
      const result = await this.templatesGateway.listForProject(projectId);
      if (result.isFail()) {
        this.notifications.error(`Could not load ${DATASET}: ${result.error.message}`);
        return;
      }
      runInAction(() => {
        this.templatesRepository.setTemplates(result.value);
        this._loadedProjectId = projectId;
      });
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
  };
}

export const TemplatesTabPresenter = Abstraction.createImplementation({
  implementation: TemplatesTabPresenterImpl,
  dependencies: [TemplatesGateway, TemplatesRepository, DeleteTemplateUseCase, NotificationService],
});
