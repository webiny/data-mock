import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectPersistenceError, ScanRootNotFoundError } from "~/shared/errors.js";

export interface IRemoveScanRootRepositoryInput {
  id: string;
}

export interface IRemoveScanRootRepository {
  execute(
    input: RemoveScanRootRepository.Input,
  ): Promise<Result<void, RemoveScanRootRepository.Error>>;
}

export const RemoveScanRootRepository = createAbstraction<IRemoveScanRootRepository>(
  "ScanRoots/RemoveScanRootRepository",
);

export namespace RemoveScanRootRepository {
  export type Interface = IRemoveScanRootRepository;
  export type Input = IRemoveScanRootRepositoryInput;
  export type Error = ScanRootNotFoundError | ProjectPersistenceError;
}
