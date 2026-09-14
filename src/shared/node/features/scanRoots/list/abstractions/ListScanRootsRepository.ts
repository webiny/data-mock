import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ScanRoot } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListScanRootsRepository {
  execute(): Promise<Result<ScanRoot[], ProjectPersistenceError>>;
}

export const ListScanRootsRepository = createAbstraction<IListScanRootsRepository>(
  "ScanRoots/ListScanRootsRepository",
);

export namespace ListScanRootsRepository {
  export type Interface = IListScanRootsRepository;
  export type Error = ProjectPersistenceError;
}
