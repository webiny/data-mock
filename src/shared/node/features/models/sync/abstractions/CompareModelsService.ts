import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type {
  ProjectNotFoundError,
  GraphQLRequestError,
  ProjectPersistenceError,
} from "~/shared/errors.js";

export interface IModelDiffItem {
  modelId: string;
  name: string;
  status: "added" | "removed" | "changed" | "unchanged";
  changes?: string[];
}

export interface ICompareModelsServiceInput {
  projectId: string;
}

export interface ICompareModelsServiceOutput {
  items: IModelDiffItem[];
}

export interface ICompareModelsService {
  execute(
    input: CompareModelsService.Input,
  ): Promise<Result<CompareModelsService.Output, CompareModelsService.Error>>;
}

export const CompareModelsService = createAbstraction<ICompareModelsService>(
  "Models/CompareModelsService",
);

export namespace CompareModelsService {
  export type Interface = ICompareModelsService;
  export type Input = ICompareModelsServiceInput;
  export type Output = ICompareModelsServiceOutput;
  export type DiffItem = IModelDiffItem;
  export type Error = ProjectNotFoundError | GraphQLRequestError | ProjectPersistenceError;
}
