import { createAbstraction } from "@webiny/stdlib";
import type { IJobExecutor } from "../../abstractions/JobExecutor.js";

export const DeployJobExecutor = createAbstraction<IJobExecutor>("Jobs/DeployJobExecutor");

export namespace DeployJobExecutor {
  export type Interface = IJobExecutor;
}
