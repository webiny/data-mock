import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { DeletionImpact } from "~/shared/types.js";
import type {
  EnvironmentNotFoundError,
  ProjectNotFoundError,
  ProjectPersistenceError,
} from "~/shared/errors.js";

export type DeletionScope = "project" | "environment";

export interface IDeletionImpactServiceInput {
  scope: DeletionScope;
  id: string;
}

export interface IDeletionImpactService {
  execute(
    input: DeletionImpactService.Input,
  ): Promise<Result<DeletionImpact, DeletionImpactService.Error>>;
}

export const DeletionImpactService = createAbstraction<IDeletionImpactService>(
  "Deletion/DeletionImpactService",
);

export namespace DeletionImpactService {
  export type Interface = IDeletionImpactService;
  export type Input = IDeletionImpactServiceInput;
  export type Error = ProjectNotFoundError | EnvironmentNotFoundError | ProjectPersistenceError;
}
