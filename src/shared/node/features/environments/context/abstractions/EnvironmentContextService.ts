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
  /** The tenant to talk as. Defaults to the environment's own (root) tenant. */
  tenant?: string | undefined;
}

/**
 * Everything a service needs to talk to one deployed environment, resolved once.
 *
 * `apiUrl` comes from the environment; `operationsVersion` comes from the project, because the
 * GraphQL operation set is a property of the Webiny version on disk, not of a stack.
 *
 * `apiToken` is the requested tenant's. A tenant's own token wins; the environment's token stands
 * in only for the environment's default (root) tenant, never for any other.
 */
export interface IEnvironmentContext {
  project: Project;
  environment: ProjectEnvironment;
  apiUrl: string;
  apiToken: string;
  tenant: string;
  operationsVersion: string;
  /** The token to talk as any tenant of this environment, or null when it has none. */
  apiTokenFor(tenant: string): string | null;
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
