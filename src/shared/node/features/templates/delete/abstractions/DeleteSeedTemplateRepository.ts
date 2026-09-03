import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IDeleteSeedTemplateRepository {
  execute(
    input: DeleteSeedTemplateRepository.Input,
  ): Promise<Result<void, ProjectNotFoundError | ProjectPersistenceError>>;
}

export const DeleteSeedTemplateRepository = createAbstraction<IDeleteSeedTemplateRepository>(
  "Templates/DeleteSeedTemplateRepository",
);

export namespace DeleteSeedTemplateRepository {
  export type Interface = IDeleteSeedTemplateRepository;
  export interface Input {
    id: string;
  }
}
