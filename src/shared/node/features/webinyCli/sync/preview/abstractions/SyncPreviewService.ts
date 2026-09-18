import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SyncPreviewResponse } from "~/shared/responses/sync.js";
import type {
  ProjectNotFoundError,
  ProjectPersistenceError,
  ValidationError,
} from "~/shared/errors.js";

export interface ISyncPreviewInput {
  projectId: string;
}

export interface ISyncPreviewService {
  execute(
    input: SyncPreviewService.Input,
  ): Promise<Result<SyncPreviewService.Output, SyncPreviewService.Error>>;
}

export const SyncPreviewService = createAbstraction<ISyncPreviewService>(
  "WebinyCli/SyncPreviewService",
);

export namespace SyncPreviewService {
  export type Interface = ISyncPreviewService;
  export type Input = ISyncPreviewInput;
  export type Output = SyncPreviewResponse;
  export type Error = ProjectNotFoundError | ProjectPersistenceError | ValidationError;
}
