import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ScanResult } from "~/shared/types.js";
import type { ProjectPersistenceError, ValidationError } from "~/shared/errors.js";

export interface IProjectScannerInput {
  /**
   * Scan these directories instead of the stored scan roots. Used by the "scan this path" flow,
   * where the user names a directory that is not a saved root.
   */
  paths?: string[] | undefined;
  /** How deep below each root to look. Defaults to 3. */
  maxDepth?: number | undefined;
}

export interface IProjectScanner {
  execute(input: ProjectScanner.Input): Promise<Result<ScanResult, ProjectScanner.Error>>;
}

export const ProjectScanner = createAbstraction<IProjectScanner>("FileSystem/ProjectScanner");

export namespace ProjectScanner {
  export type Interface = IProjectScanner;
  export type Input = IProjectScannerInput;
  export type Error = ValidationError | ProjectPersistenceError;
}
