import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectStack } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListStacksRepositoryInput {
  environmentId: string;
}

export interface IListStacksRepository {
  execute(
    input: ListStacksRepository.Input,
  ): Promise<Result<ProjectStack[], ListStacksRepository.Error>>;
}

export const ListStacksRepository = createAbstraction<IListStacksRepository>(
  "Environments/ListStacksRepository",
);

export namespace ListStacksRepository {
  export type Interface = IListStacksRepository;
  export type Input = IListStacksRepositoryInput;
  export type Error = ProjectPersistenceError;
}
