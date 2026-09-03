import { Result } from "@webiny/stdlib";
import type { SeedTemplate } from "~/shared/types.js";
import {
  listSeedTemplatesRoute,
  createSeedTemplateRoute,
  deleteSeedTemplateRoute,
} from "~/shared/routes/templates.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { TemplatesGateway as Abstraction } from "./abstractions/TemplatesGateway.js";

class TemplatesGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async listForProject(projectId: string): Promise<Result<SeedTemplate[], HTTPError>> {
    const result = await this.httpClient.request(listSeedTemplatesRoute, {
      params: { projectId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.templates.items);
  }

  public async create(
    projectId: string,
    input: Abstraction.CreateInput,
  ): Promise<Result<SeedTemplate, HTTPError>> {
    const result = await this.httpClient.request(createSeedTemplateRoute, {
      params: { projectId },
      body: input,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.template);
  }

  public async remove(projectId: string, templateId: string): Promise<Result<void, HTTPError>> {
    const result = await this.httpClient.request(deleteSeedTemplateRoute, {
      params: { projectId, templateId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(undefined);
  }
}

export const TemplatesGateway = Abstraction.createImplementation({
  implementation: TemplatesGatewayImpl,
  dependencies: [HTTPClient],
});
