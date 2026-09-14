import { Result, Logger } from "@webiny/stdlib";
import { CreateProjectRepository } from "./abstractions/CreateProjectRepository.js";
import { CreateProjectUseCase as Abstraction } from "./abstractions/CreateProjectUseCase.js";
import { CreateEnvironmentRepository } from "~/shared/node/features/environments/create/abstractions/CreateEnvironmentRepository.js";
import { TenantSyncService } from "~/shared/node/features/tenants/sync/abstractions/TenantSyncService.js";
import { VerifyProjectAccessService } from "~/shared/node/features/tenants/verify/abstractions/VerifyProjectAccessService.js";
import { createProjectBodySchema } from "~/shared/responses/projects.js";
import { ValidationError } from "~/shared/errors.js";

const DEFAULT_ENV = "dev";

class CreateProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly createProjectRepository: CreateProjectRepository.Interface,
    private readonly createEnvironmentRepository: CreateEnvironmentRepository.Interface,
    private readonly tenantSyncService: TenantSyncService.Interface,
    private readonly verifyProjectAccessService: VerifyProjectAccessService.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const parsed = createProjectBodySchema.safeParse(input);

    if (!parsed.success) {
      return Result.fail(new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input"));
    }

    const body = parsed.data;

    const createResult = await this.createProjectRepository.execute({
      name: body.name,
      rootPath: body.rootPath ?? null,
      operationsVersion: body.operationsVersion,
      awsProfile: body.awsProfile ?? null,
      awsRegion: body.awsRegion ?? null,
    });

    if (createResult.isFail()) {
      return Result.fail(createResult.error);
    }

    const project = createResult.value;

    /**
     * A folder-backed project gets its environments from the next sync, which reads the Pulumi
     * checkpoints. A remote-only project has no checkpoints, so the connection details supplied at
     * creation become its one environment.
     */
    const environmentResult = await this.createEnvironmentRepository.execute({
      projectId: project.id,
      env: body.env ?? DEFAULT_ENV,
      apiUrl: body.apiUrl ?? null,
      apiToken: body.apiToken ?? null,
      tenant: body.tenant,
      deployed: body.apiUrl !== undefined,
    });

    if (environmentResult.isFail()) {
      return Result.fail(environmentResult.error);
    }

    const environment = environmentResult.value;

    // Verification and tenant discovery only mean anything once there is an API to talk to.
    if (environment.apiUrl !== null && environment.apiToken !== null) {
      const verifyResult = await this.verifyProjectAccessService.execute({
        apiUrl: environment.apiUrl,
        apiToken: environment.apiToken,
        tenant: environment.tenant,
      });

      if (verifyResult.isFail()) {
        this.logger.warn(
          `API access verification failed for project "${project.name}": ${verifyResult.error.message}`,
        );
      }

      const syncResult = await this.tenantSyncService.execute({ environmentId: environment.id });

      if (syncResult.isFail()) {
        this.logger.warn(
          `Tenant sync failed for project "${project.name}": ${syncResult.error.message}`,
        );
      } else {
        this.logger.info(
          `Synced ${syncResult.value.synced} tenant(s) for project "${project.name}".`,
        );
      }
    }

    return Result.ok({ project, environment });
  }
}

export const CreateProjectUseCase = Abstraction.createImplementation({
  implementation: CreateProjectUseCaseImpl,
  dependencies: [
    CreateProjectRepository,
    CreateEnvironmentRepository,
    TenantSyncService,
    VerifyProjectAccessService,
    Logger,
  ],
});
