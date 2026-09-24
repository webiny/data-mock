import { createAbstraction } from "@webiny/stdlib";
import type { IJobExecutor } from "../../abstractions/JobExecutor.js";

export const SyncSystemJobExecutor = createAbstraction<IJobExecutor>("Jobs/SyncSystemJobExecutor");

export namespace SyncSystemJobExecutor {
  export type Interface = IJobExecutor;
}
