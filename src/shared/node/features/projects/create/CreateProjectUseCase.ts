import { Result, Logger } from "@webiny/stdlib";
import { CreateProjectRepository } from "./abstractions/CreateProjectRepository.js";
import { CreateProjectUseCase as Abstraction } from "./abstractions/CreateProjectUseCase.js";
import { TenantSyncService } from "~/shared/node/features/tenants/sync/abstractions/TenantSyncService.js";
import { VerifyProjectAccessService } from "~/shared/node/features/tenants/verify/abstractions/VerifyProjectAccessService.js";
import { createProjectBodySchema } from "~/shared/responses/projects.js";
import { ValidationError } from "~/shared/errors.js";
import type { Project } from "~/shared/types.js";

class CreateProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly createProjectRepository: CreateProjectRepository.Interface,
    private readonly tenantSyncService: TenantSyncService.Interface,
    private readonly verifyProjectAccessService: VerifyProjectAccessService.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(input: Abstraction.Input): Promise<Result<Project, Abstraction.Error>> {
    const parsed = createProjectBodySchema.safeParse(input);

    if (!parsed.success) {
      return Result.fail(new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input"));
    }

    const createResult = await this.createProjectRepository.execute(parsed.data);

    if (createResult.isFail()) {
      return createResult;
    }

    const project = createResult.value;

    const verifyResult = await this.verifyProjectAccessService.execute({
      apiUrl: project.apiUrl,
      apiToken: project.apiToken,
      tenant: project.tenant,
    });

    if (verifyResult.isFail()) {
      this.logger.warn(
        `API access verification failed for project "${project.name}": ${verifyResult.error.message}`,
      );
    }

    const syncResult = await this.tenantSyncService.execute({ projectId: project.id });

    if (syncResult.isFail()) {
      this.logger.warn(
        `Tenant sync failed for project "${project.name}": ${syncResult.error.message}`,
      );
    } else {
      this.logger.info(
        `Synced ${syncResult.value.synced} tenant(s) for project "${project.name}".`,
      );
    }

    return Result.ok(project);
  }
}

export const CreateProjectUseCase = Abstraction.createImplementation({
  implementation: CreateProjectUseCaseImpl,
  dependencies: [CreateProjectRepository, TenantSyncService, VerifyProjectAccessService, Logger],
});
