import { createAbstraction } from "@webiny/stdlib";
import type { SeedTemplateConfig } from "~/shared/types.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";

export interface ITemplateVM {
  id: string;
  name: string;
  config: SeedTemplateConfig;
}

export interface ITemplatesTabVM {
  templates: ITemplateVM[];
  isLoading: boolean;
}

export interface ITemplatesTabPresenter {
  readonly vm: ITemplatesTabVM;
  /**
   * Reads the tab's data for the context it is mounted on, once. Called by the component when it
   * mounts and again whenever the context changes — templates are project-scoped, so this reads
   * as soon as a project id is known, without waiting for an environment to resolve.
   */
  activate(context: ProjectDetailTabContext): Promise<void>;
  /** Navigates to the seed config route, pre-filled from the given template. */
  loadTemplate(templateId: string): void;
  deleteTemplate(templateId: string): Promise<void>;
  dispose(): void;
}

export const TemplatesTabPresenter = createAbstraction<ITemplatesTabPresenter>(
  "Ui/TemplatesTabPresenter",
);

export namespace TemplatesTabPresenter {
  export type Interface = ITemplatesTabPresenter;
  export type VM = ITemplatesTabVM;
}
