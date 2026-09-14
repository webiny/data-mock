import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { GenericRecord, ProjectStack, StackReadState } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IUpsertStackRepositoryInput {
  environmentId: string;
  app: string;
  readState: StackReadState;
  deployed: boolean;
  resourceCount?: number | null;
  stackOutput?: GenericRecord<string, unknown> | null;
}

export interface IUpsertStackRepository {
  execute(
    input: UpsertStackRepository.Input,
  ): Promise<Result<ProjectStack, UpsertStackRepository.Error>>;
}

export const UpsertStackRepository = createAbstraction<IUpsertStackRepository>(
  "Environments/UpsertStackRepository",
);

export namespace UpsertStackRepository {
  export type Interface = IUpsertStackRepository;
  export type Input = IUpsertStackRepositoryInput;
  export type Error = ProjectPersistenceError;
}
