import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectModel } from "~/shared/types.js";

export interface IModelDependencyResolverInput {
  models: ProjectModel[];
}

export interface IModelDependencyResolverOutput {
  ordered: ProjectModel[];
  circular: string[][];
}

export interface IModelDependencyResolver {
  execute(
    input: ModelDependencyResolver.Input,
  ): Result<ModelDependencyResolver.Output, ModelDependencyResolver.Error>;
}

export const ModelDependencyResolver = createAbstraction<IModelDependencyResolver>(
  "Seeding/ModelDependencyResolver",
);

export namespace ModelDependencyResolver {
  export type Interface = IModelDependencyResolver;
  export type Input = IModelDependencyResolverInput;
  export type Output = IModelDependencyResolverOutput;
  export type Error = never;
}
