import { makeAutoObservable } from "mobx";
import type { SeedTemplate } from "~/shared/types.js";
import { TemplatesRepository as Abstraction } from "./abstractions/TemplatesRepository.js";

class TemplatesRepositoryImpl implements Abstraction.Interface {
  private _templates: SeedTemplate[] = [];

  public constructor() {
    makeAutoObservable(this);
  }

  public get templates(): SeedTemplate[] {
    return this._templates;
  }

  public setTemplates = (templates: SeedTemplate[]): void => {
    this._templates = templates;
  };

  public addTemplate = (template: SeedTemplate): void => {
    this._templates.push(template);
  };

  public removeTemplate = (id: string): void => {
    this._templates = this._templates.filter((t) => t.id !== id);
  };

  public getTemplatesByProjectId = (projectId: string): SeedTemplate[] => {
    return this._templates.filter((t) => t.projectId === projectId);
  };
}

export const TemplatesRepository = Abstraction.createImplementation({
  implementation: TemplatesRepositoryImpl,
  dependencies: [],
});
