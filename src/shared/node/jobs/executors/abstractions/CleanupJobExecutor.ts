import { createAbstraction } from "@webiny/stdlib";
import type { IJobExecutor } from "../../abstractions/JobExecutor.js";

export const CleanupJobExecutor = createAbstraction<IJobExecutor>("Jobs/CleanupJobExecutor");

export namespace CleanupJobExecutor {
  export type Interface = IJobExecutor;
}
