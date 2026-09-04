import { createAbstraction } from "@webiny/stdlib";
import type { JobExecutor } from "./JobExecutor.js";

export interface IJobExecutorRegistry {
  getExecutor(type: string): JobExecutor.Interface;
}

export const JobExecutorRegistry = createAbstraction<IJobExecutorRegistry>(
  "Jobs/JobExecutorRegistry",
);

export namespace JobExecutorRegistry {
  export type Interface = IJobExecutorRegistry;
}
