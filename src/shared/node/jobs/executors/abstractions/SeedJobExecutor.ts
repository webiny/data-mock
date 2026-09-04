import { createAbstraction } from "@webiny/stdlib";
import type { IJobExecutor } from "../../abstractions/JobExecutor.js";

export const SeedJobExecutor = createAbstraction<IJobExecutor>("Jobs/SeedJobExecutor");

export namespace SeedJobExecutor {
  export type Interface = IJobExecutor;
}
