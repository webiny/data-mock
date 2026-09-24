import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SyncStatus } from "~/shared/types.js";
import type {
  ProjectNotFoundError,
  ProjectPersistenceError,
  ValidationError,
} from "~/shared/errors.js";

export interface ISyncSystemInput {
  projectId: string;
  onProgress?: ((percent: number, label: string) => void) | undefined;
}

export interface ISyncSystemOutput {
  status: SyncStatus;
  versionMajor: number | null;
  webinyVersion: string | null;
  environmentsFound: number;
  environmentsDeployed: number;
  stacksRead: number;
  /** Stacks whose checkpoint could not be read; their stored output is left untouched. */
  stacksUnknown: number;
  messages: string[];
}

export interface ISyncSystemService {
  execute(
    input: SyncSystemService.Input,
  ): Promise<Result<SyncSystemService.Output, SyncSystemService.Error>>;
}

export const SyncSystemService = createAbstraction<ISyncSystemService>(
  "WebinyCli/SyncSystemService",
);

export namespace SyncSystemService {
  export type Interface = ISyncSystemService;
  export type Input = ISyncSystemInput;
  export type Output = ISyncSystemOutput;
  export type Error = ProjectNotFoundError | ProjectPersistenceError | ValidationError;
}
