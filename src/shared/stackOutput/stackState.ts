import { readAdminUrl, readApiUrl, readRegion } from "./stackOutputKeyMap.js";
import type { GenericRecord, StackReadState } from "~/shared/types.js";

/** What is stored for one app of one environment. */
export interface IStoredStackState {
  app: string;
  deployed: boolean;
  resourceCount: number | null;
  stackOutput: GenericRecord<string, unknown> | null;
  readState: StackReadState;
}

/** What one read of an app's state produced, from a checkpoint or from the CLI. */
export interface IStackRead {
  readState: StackReadState;
  deployed: boolean;
  resourceCount: number | null;
  outputs: GenericRecord<string, unknown> | null;
}

/** The environment-level facts derived from the whole set of an environment's stacks. */
export interface IDerivedEnvironmentState {
  deployed: boolean;
  apiUrl: string | null;
  adminUrl: string | null;
  region: string | null;
}

/**
 * What a stack row becomes once a read is applied to it.
 *
 * An "unknown" read means the stack file was missing, unreadable or unparseable. It still updates
 * the read state and whether the app is deployed, but it must not write nulls over a
 * previously-good `stackOutput` — that output is the only record of what is deployed.
 */
export function mergeStackRead(
  app: string,
  current: IStoredStackState | null,
  read: IStackRead,
): IStoredStackState {
  if (read.readState === "unknown") {
    return {
      app,
      deployed: read.deployed,
      readState: read.readState,
      resourceCount: current?.resourceCount ?? null,
      stackOutput: current?.stackOutput ?? null,
    };
  }

  return {
    app,
    deployed: read.deployed,
    readState: read.readState,
    resourceCount: read.resourceCount,
    stackOutput: read.outputs,
  };
}

/**
 * Derives the environment row from EVERY one of its stacks, not just the ones a run happened to
 * read.
 *
 * A deploy of `api` alone refreshes only `api`. Deriving from that read alone would write a null
 * `adminUrl` over a perfectly good one, and destroying `admin` alone would mark the whole
 * environment not-deployed while core and api are still up.
 */
export function deriveEnvironmentState(stacks: IStoredStackState[]): IDerivedEnvironmentState {
  return {
    deployed: stacks.some((stack) => stack.deployed),
    apiUrl: readApiUrl(outputsOf(stacks, "api")),
    adminUrl: readAdminUrl(outputsOf(stacks, "admin")),
    region: readRegion(outputsOf(stacks, "api")) ?? readRegion(outputsOf(stacks, "core")),
  };
}

/**
 * The stored output of one app, but only while that app is deployed. A destroyed stack keeps its
 * last output for reference, and reading a URL back out of it would report a torn-down API as live.
 */
function outputsOf(
  stacks: IStoredStackState[],
  app: string,
): GenericRecord<string, unknown> | null {
  const stack = stacks.find((candidate) => candidate.app === app);
  return stack !== undefined && stack.deployed ? stack.stackOutput : null;
}
