import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Job, ProjectEnvironment, ProjectStack } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IEnvironmentsGateway {
  listForProject(projectId: string): Promise<Result<ProjectEnvironment[], HTTPError>>;
  listStacks(
    projectId: string,
    environmentId: string,
  ): Promise<Result<ProjectStack[], HTTPError>>;
  sync(projectId: string): Promise<Result<Job, HTTPError>>;
}

export const EnvironmentsGateway = createAbstraction<IEnvironmentsGateway>(
  "Ui/EnvironmentsGateway",
);

export namespace EnvironmentsGateway {
  export type Interface = IEnvironmentsGateway;
}
