import { createAbstraction } from "@webiny/stdlib";
import type { IJobExecutor } from "../../abstractions/JobExecutor.js";

export const DestroyJobExecutor = createAbstraction<IJobExecutor>("Jobs/DestroyJobExecutor");

export namespace DestroyJobExecutor {
  export type Interface = IJobExecutor;
}
