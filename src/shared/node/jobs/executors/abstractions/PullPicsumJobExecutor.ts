import { createAbstraction } from "@webiny/stdlib";
import type { IJobExecutor } from "../../abstractions/JobExecutor.js";

export const PullPicsumJobExecutor = createAbstraction<IJobExecutor>("Jobs/PullPicsumJobExecutor");

export namespace PullPicsumJobExecutor {
  export type Interface = IJobExecutor;
}
