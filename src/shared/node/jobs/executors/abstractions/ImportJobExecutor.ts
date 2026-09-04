import { createAbstraction } from "@webiny/stdlib";
import type { IJobExecutor } from "../../abstractions/JobExecutor.js";

export const ImportJobExecutor = createAbstraction<IJobExecutor>("Jobs/ImportJobExecutor");

export namespace ImportJobExecutor {
  export type Interface = IJobExecutor;
}
