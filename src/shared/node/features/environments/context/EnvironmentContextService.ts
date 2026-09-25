import { Result } from "@webiny/stdlib";
import { GetEnvironmentRepository } from "../get/abstractions/GetEnvironmentRepository.js";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { ListProjectTenantsRepository } from "~/shared/node/features/tenants/list/abstractions/ListProjectTenantsRepository.js";
import { EnvironmentContextService as Abstraction } from "./abstractions/EnvironmentContextService.js";
import { EnvironmentNotConnectedError } from "~/shared/errors.js";

class EnvironmentContextServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getEnvironmentRepository: GetEnvironmentRepository.Interface,
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly listProjectTenantsRepository: ListProjectTenantsRepository.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const environmentResult = await this.getEnvironmentRepository.execute({
      id: input.environmentId,
    });

    if (environmentResult.isFail()) {
      return Result.fail(environmentResult.error);
    }

    const environment = environmentResult.value;

    const projectResult = await this.getProjectRepository.execute({ id: environment.projectId });

    if (projectResult.isFail()) {
      return Result.fail(projectResult.error);
    }

    if (environment.apiUrl === null) {
      return Result.fail(
        new EnvironmentNotConnectedError(environment.env, "the api app is not deployed"),
      );
    }

    const tenantsResult = await this.listProjectTenantsRepository.execute({
      environmentId: environment.id,
    });

    if (tenantsResult.isFail()) {
      return Result.fail(tenantsResult.error);
    }

    const tenantTokens = new Map(
      tenantsResult.value.map((tenant) => [tenant.tenantId, tenant.apiToken]),
    );
    const apiTokenFor = (tenant: string): string | null =>
      tenantTokens.get(tenant) ?? (tenant === environment.tenant ? environment.apiToken : null);

    const tenant = input.tenant ?? environment.tenant;
    const apiToken = apiTokenFor(tenant);

    if (apiToken === null) {
      return Result.fail(
        new EnvironmentNotConnectedError(
          environment.env,
          `no API token is set for tenant "${tenant}"`,
        ),
      );
    }

    return Result.ok({
      project: projectResult.value,
      environment,
      apiUrl: environment.apiUrl,
      apiToken,
      tenant,
      operationsVersion: projectResult.value.operationsVersion,
      apiTokenFor,
    });
  }
}

export const EnvironmentContextService = Abstraction.createImplementation({
  implementation: EnvironmentContextServiceImpl,
  dependencies: [GetEnvironmentRepository, GetProjectRepository, ListProjectTenantsRepository],
});
