import { createAbstraction } from "@webiny/stdlib";
import type { SeedTemplate } from "~/shared/types.js";

export interface ITemplatesRepository {
  readonly templates: SeedTemplate[];
  setTemplates(templates: SeedTemplate[]): void;
  addTemplate(template: SeedTemplate): void;
  removeTemplate(id: string): void;
  getTemplatesByProjectId(projectId: string): SeedTemplate[];
}

export const TemplatesRepository =
  createAbstraction<ITemplatesRepository>("Ui/TemplatesRepository");

export namespace TemplatesRepository {
  export type Interface = ITemplatesRepository;
}
