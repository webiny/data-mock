import { Result } from "@webiny/stdlib";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { TemplatesGateway } from "~/ui/features/templates/abstractions/TemplatesGateway.js";
import { TemplatesRepository } from "~/ui/features/templates/abstractions/TemplatesRepository.js";
import { DeleteTemplateUseCase as Abstraction } from "./abstractions/DeleteTemplateUseCase.js";

class DeleteTemplateUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly templatesGateway: TemplatesGateway.Interface,
    private readonly templatesRepository: TemplatesRepository.Interface,
  ) {}

  public async execute(input: {
    projectId: string;
    templateId: string;
  }): Promise<Result<void, HTTPError>> {
    const result = await this.templatesGateway.remove(input.projectId, input.templateId);
    if (result.isFail()) {
      return Result.fail(result.error);
    }
    this.templatesRepository.removeTemplate(input.templateId);
    return Result.ok(undefined);
  }
}

export const DeleteTemplateUseCase = Abstraction.createImplementation({
  implementation: DeleteTemplateUseCaseImpl,
  dependencies: [TemplatesGateway, TemplatesRepository],
});
