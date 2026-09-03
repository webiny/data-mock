import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedTemplate } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface ITemplatesGateway {
  listForProject(projectId: string): Promise<Result<SeedTemplate[], HTTPError>>;
  create(
    projectId: string,
    input: TemplatesGateway.CreateInput,
  ): Promise<Result<SeedTemplate, HTTPError>>;
  remove(projectId: string, templateId: string): Promise<Result<void, HTTPError>>;
}

export const TemplatesGateway = createAbstraction<ITemplatesGateway>("Ui/TemplatesGateway");

export namespace TemplatesGateway {
  export type Interface = ITemplatesGateway;
  export interface CreateInput {
    name: string;
    config: { tenant: string; models: Array<{ modelId: string; amount: number }> };
  }
}
