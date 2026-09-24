import { Result } from "@webiny/stdlib";
import { GetEnvironmentRepository } from "../get/abstractions/GetEnvironmentRepository.js";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { EnvironmentContextService as Abstraction } from "./abstractions/EnvironmentContextService.js";
import { EnvironmentNotConnectedError } from "~/shared/errors.js";

class EnvironmentContextServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getEnvironmentRepository: GetEnvironmentRepository.Interface,
    private readonly getProjectRepository: GetProjectRepository.Interface,
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

    if (environment.apiToken === null) {
      return Result.fail(new EnvironmentNotConnectedError(environment.env, "no API token is set"));
    }

    return Result.ok({
      project: projectResult.value,
      environment,
      apiUrl: environment.apiUrl,
      apiToken: environment.apiToken,
      tenant: environment.tenant,
      operationsVersion: projectResult.value.operationsVersion,
    });
  }
}

export const EnvironmentContextService = Abstraction.createImplementation({
  implementation: EnvironmentContextServiceImpl,
  dependencies: [GetEnvironmentRepository, GetProjectRepository],
});
