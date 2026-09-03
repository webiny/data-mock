import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedTemplate, SeedTemplateConfig } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface ICreateSeedTemplateRepository {
  execute(
    input: CreateSeedTemplateRepository.Input,
  ): Promise<Result<SeedTemplate, ProjectPersistenceError>>;
}

export const CreateSeedTemplateRepository = createAbstraction<ICreateSeedTemplateRepository>(
  "Templates/CreateSeedTemplateRepository",
);

export namespace CreateSeedTemplateRepository {
  export type Interface = ICreateSeedTemplateRepository;
  export interface Input {
    projectId: string;
    name: string;
    config: SeedTemplateConfig;
  }
}
