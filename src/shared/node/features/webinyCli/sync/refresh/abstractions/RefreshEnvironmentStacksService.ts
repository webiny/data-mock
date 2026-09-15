import { createAbstraction } from "@webiny/stdlib";
import type { GenericRecord, ProjectEnvironment, StackReadState } from "~/shared/types.js";

/** What one app's state read produced, from a checkpoint or from the CLI. */
export interface IStackReadResult {
  readState: StackReadState;
  deployed: boolean;
  resourceCount: number | null;
  outputs: GenericRecord<string, unknown> | null;
}

export interface IRefreshEnvironmentStacksInput {
  /** Absolute path to the checkout whose Pulumi state is read. */
  rootPath: string;
  environment: ProjectEnvironment;
  /** Apps to read. A deploy refreshes only what it touched; a sync passes every app. */
  apps: string[];
  /** Called once per app read, for progress reporting. */
  onApp?: (() => void) | undefined;
  /**
   * How to read one app's state. Defaults to the Pulumi checkpoint on disk. The remote-backend
   * path passes a reader backed by `webiny output`, so the derivation below stays in one place
   * rather than being written twice with two chances to disagree.
   */
  readStack?: ((app: string) => Promise<IStackReadResult>) | undefined;
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
