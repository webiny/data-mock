import { createAbstraction } from "@webiny/stdlib";
import type { IJobExecutor } from "../../abstractions/JobExecutor.js";

export const SyncPreviewJobExecutor = createAbstraction<IJobExecutor>(
  "Jobs/SyncPreviewJobExecutor",
);

export namespace SyncPreviewJobExecutor {
  export type Interface = IJobExecutor;
}
