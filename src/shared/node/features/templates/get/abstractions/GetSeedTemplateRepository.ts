import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedTemplate } from "~/shared/types.js";
import type { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IGetSeedTemplateRepository {
  execute(
    input: GetSeedTemplateRepository.Input,
  ): Promise<Result<SeedTemplate, ProjectNotFoundError | ProjectPersistenceError>>;
}

export const GetSeedTemplateRepository = createAbstraction<IGetSeedTemplateRepository>(
  "Templates/GetSeedTemplateRepository",
);

export namespace GetSeedTemplateRepository {
  export type Interface = IGetSeedTemplateRepository;
  export interface Input {
    id: string;
  }
}
