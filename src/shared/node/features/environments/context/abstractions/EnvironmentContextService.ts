import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project, ProjectEnvironment } from "~/shared/types.js";
import type {
  EnvironmentNotConnectedError,
  EnvironmentNotFoundError,
  ProjectNotFoundError,
  ProjectPersistenceError,
} from "~/shared/errors.js";

export interface IEnvironmentContextInput {
  environmentId: string;
}

/**
 * Everything a service needs to talk to one deployed environment, resolved once.
 *
 * `apiUrl` and `tenant` come from the environment; `operationsVersion` comes from the project,
 * because the GraphQL operation set is a property of the Webiny version on disk, not of a stack.
 */
export interface IEnvironmentContext {
  project: Project;
  environment: ProjectEnvironment;
  apiUrl: string;
  apiToken: string;
  tenant: string;
  operationsVersion: string;
}

export interface IEnvironmentContextService {
  execute(
    input: EnvironmentContextService.Input,
  ): Promise<Result<EnvironmentContextService.Output, EnvironmentContextService.Error>>;
}

export const EnvironmentContextService = createAbstraction<IEnvironmentContextService>(
  "Environments/EnvironmentContextService",
);

export namespace EnvironmentContextService {
  export type Interface = IEnvironmentContextService;
  export type Input = IEnvironmentContextInput;
  export type Output = IEnvironmentContext;
  export type Error =
    | EnvironmentNotFoundError
    | EnvironmentNotConnectedError
    | ProjectNotFoundError
    | ProjectPersistenceError;
}
