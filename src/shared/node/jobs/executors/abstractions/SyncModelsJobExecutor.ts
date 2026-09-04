import { createAbstraction } from "@webiny/stdlib";
import type { IJobExecutor } from "../../abstractions/JobExecutor.js";

export const SyncModelsJobExecutor = createAbstraction<IJobExecutor>("Jobs/SyncModelsJobExecutor");

export namespace SyncModelsJobExecutor {
  export type Interface = IJobExecutor;
}
