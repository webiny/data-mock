import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedTemplate } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListSeedTemplatesRepository {
  execute(
    input: ListSeedTemplatesRepository.Input,
  ): Promise<Result<SeedTemplate[], ProjectPersistenceError>>;
}

export const ListSeedTemplatesRepository = createAbstraction<IListSeedTemplatesRepository>(
  "Templates/ListSeedTemplatesRepository",
);

export namespace ListSeedTemplatesRepository {
  export type Interface = IListSeedTemplatesRepository;
  export interface Input {
    projectId: string;
  }
}
