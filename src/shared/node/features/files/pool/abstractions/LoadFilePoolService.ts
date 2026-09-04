import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectFile } from "~/shared/types.js";
import type {
  ProjectNotFoundError,
  ProjectPersistenceError,
  GraphQLRequestError,
} from "~/shared/errors.js";

export interface ILoadFilePoolServiceInput {
  projectId: string;
  tenant: string;
  onProgress?: ((percent: number, label: string) => void) | undefined;
}

export interface ILoadFilePoolServiceOutput {
  filePool: ProjectFile[];
}

export interface ILoadFilePoolService {
  execute(
    input: LoadFilePoolService.Input,
  ): Promise<Result<LoadFilePoolService.Output, LoadFilePoolService.Error>>;
}

export const LoadFilePoolService = createAbstraction<ILoadFilePoolService>(
  "Files/LoadFilePoolService",
);

export namespace LoadFilePoolService {
  export type Interface = ILoadFilePoolService;
  export type Input = ILoadFilePoolServiceInput;
  export type Output = ILoadFilePoolServiceOutput;
  export type Error = ProjectPersistenceError | ProjectNotFoundError | GraphQLRequestError;
}
