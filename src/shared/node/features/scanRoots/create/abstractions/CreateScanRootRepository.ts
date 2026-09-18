import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ScanRoot } from "~/shared/types.js";
import type { ProjectPersistenceError, ValidationError } from "~/shared/errors.js";

export interface ICreateScanRootRepositoryInput {
  /** Absolute path to a directory to scan for Webiny checkouts. */
  path: string;
}

export interface ICreateScanRootRepository {
  execute(
    input: CreateScanRootRepository.Input,
  ): Promise<Result<ScanRoot, CreateScanRootRepository.Error>>;
}

export const CreateScanRootRepository = createAbstraction<ICreateScanRootRepository>(
  "ScanRoots/CreateScanRootRepository",
);

export namespace CreateScanRootRepository {
  export type Interface = ICreateScanRootRepository;
  export type Input = ICreateScanRootRepositoryInput;
  export type Error = ValidationError | ProjectPersistenceError;
}
