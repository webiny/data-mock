import { TemplatesGateway } from "~/ui/features/templates/abstractions/TemplatesGateway.js";
import { TemplatesRepository } from "~/ui/features/templates/abstractions/TemplatesRepository.js";
import { DeleteTemplateUseCase as Abstraction } from "./abstractions/DeleteTemplateUseCase.js";

class DeleteTemplateUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly templatesGateway: TemplatesGateway.Interface,
    private readonly templatesRepository: TemplatesRepository.Interface,
  ) {}

  public async execute(input: { projectId: string; templateId: string }): Promise<void> {
    const result = await this.templatesGateway.remove(input.projectId, input.templateId);
    if (result.isOk()) {
      this.templatesRepository.removeTemplate(input.templateId);
    }
  }
}

export const DeleteTemplateUseCase = Abstraction.createImplementation({
  implementation: DeleteTemplateUseCaseImpl,
  dependencies: [TemplatesGateway, TemplatesRepository],
});
