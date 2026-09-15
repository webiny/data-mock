import { createAbstraction } from "@webiny/stdlib";
import type { ProjectEnvironment } from "~/shared/types.js";

export interface IRefreshEnvironmentStacksInput {
  /** Absolute path to the checkout whose Pulumi state is read. */
  rootPath: string;
  environment: ProjectEnvironment;
  /** Apps to read. A deploy refreshes only what it touched; a sync passes every app. */
  apps: string[];
  /** Called once per app read, for progress reporting. */
  onApp?: (() => void) | undefined;
}

export interface IRefreshEnvironmentStacksOutput {
  /** Stacks whose state was determined — deployed or not-deployed. */
  read: number;
  /** Stacks that could not be read. Their stored output was left untouched. */
  unknown: number;
  /** True when any app of this environment is deployed. */
  deployed: boolean;
}

export interface IRefreshEnvironmentStacksService {
  execute(
    input: RefreshEnvironmentStacksService.Input,
  ): Promise<RefreshEnvironmentStacksService.Output>;
}

export const RefreshEnvironmentStacksService = createAbstraction<IRefreshEnvironmentStacksService>(
  "WebinyCli/RefreshEnvironmentStacksService",
);

export namespace RefreshEnvironmentStacksService {
  export type Interface = IRefreshEnvironmentStacksService;
  export type Input = IRefreshEnvironmentStacksInput;
  export type Output = IRefreshEnvironmentStacksOutput;
}
