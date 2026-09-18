import { createAbstraction } from "@webiny/stdlib";
import type { GenericRecord, StackReadState } from "~/shared/types.js";

export interface IReadRemoteStackInput {
  /** Absolute path to the project root. The CLI runs here. */
  rootPath: string;
  /** 5 or 6. The two majors differ in flag names and in what they print. */
  versionMajor: number;
  app: string;
  env: string;
  variant: string;
  region?: string | null | undefined;
  awsProfile?: string | null | undefined;
  signal?: AbortSignal | undefined;
}

export interface IReadRemoteStackOutput {
  readState: StackReadState;
  deployed: boolean;
  /**
   * Always null. Neither CLI reports a resource count — it exists only in the checkpoint, which is
   * in the bucket, not on disk.
   */
  resourceCount: null;
  outputs: GenericRecord<string, unknown> | null;
  error: string | null;
  /**
   * True when the answer came from a cache the CLI would not let us bypass. The row is stored, but
   * the project's sync status is marked `stale-possible` rather than presented as fresh.
   */
  possiblyStale: boolean;
}

export interface IRemoteStackOutputReader {
  /** Never throws. An unreadable stack is "unknown", which is not the same as a destroyed one. */
  execute(input: RemoteStackOutputReader.Input): Promise<RemoteStackOutputReader.Output>;
}

export const RemoteStackOutputReader = createAbstraction<IRemoteStackOutputReader>(
  "WebinyCli/RemoteStackOutputReader",
);

export namespace RemoteStackOutputReader {
  export type Interface = IRemoteStackOutputReader;
  export type Input = IReadRemoteStackInput;
  export type Output = IReadRemoteStackOutput;
}
