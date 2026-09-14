import { createAbstraction } from "@webiny/stdlib";
import type { GenericRecord, StackReadState } from "~/shared/types.js";

export interface IReadCheckpointInput {
  /** Absolute path to the project root. */
  rootPath: string;
  app: string;
  env: string;
  variant: string;
}

export interface IReadCheckpointOutput {
  readState: StackReadState;
  deployed: boolean;
  /** Null unless the checkpoint was readable. */
  resourceCount: number | null;
  outputs: GenericRecord<string, unknown> | null;
  /** Populated when readState is "unknown", to explain why. */
  error: string | null;
}

export interface IDiscoveredEnvironment {
  env: string;
  variant: string;
}

export interface IPulumiCheckpointReader {
  /**
   * Reads one app's stack. Never throws: an unreadable checkpoint is "unknown", which callers must
   * not confuse with a destroyed one.
   */
  read(input: PulumiCheckpointReader.Input): PulumiCheckpointReader.Output;
  /** Environments with a core stack file on disk — deployed or not. */
  listEnvironments(rootPath: string): IDiscoveredEnvironment[];
}

export const PulumiCheckpointReader = createAbstraction<IPulumiCheckpointReader>(
  "WebinyCli/PulumiCheckpointReader",
);

export namespace PulumiCheckpointReader {
  export type Interface = IPulumiCheckpointReader;
  export type Input = IReadCheckpointInput;
  export type Output = IReadCheckpointOutput;
  export type DiscoveredEnvironment = IDiscoveredEnvironment;
}
