import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IDeleteProjectEntriesInput {
  projectId: string;
}

export interface IDeleteProjectEntriesRepository {
  execute(
    input: DeleteProjectEntriesRepository.Input,
  ): Promise<Result<void, DeleteProjectEntriesRepository.Error>>;
}

export const DeleteProjectEntriesRepository = createAbstraction<IDeleteProjectEntriesRepository>(
  "Seeding/DeleteProjectEntriesRepository",
);

export namespace DeleteProjectEntriesRepository {
  export type Interface = IDeleteProjectEntriesRepository;
  export type Input = IDeleteProjectEntriesInput;
  export type Error = ProjectPersistenceError;
}
