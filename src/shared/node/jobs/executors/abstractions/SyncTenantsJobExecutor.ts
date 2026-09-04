import { createAbstraction } from "@webiny/stdlib";
import type { IJobExecutor } from "../../abstractions/JobExecutor.js";

export const SyncTenantsJobExecutor = createAbstraction<IJobExecutor>(
  "Jobs/SyncTenantsJobExecutor",
);

export namespace SyncTenantsJobExecutor {
  export type Interface = IJobExecutor;
}
