import { createAbstraction } from "@webiny/stdlib";
import type { IJobExecutor } from "../../abstractions/JobExecutor.js";

export const UploadFilesJobExecutor = createAbstraction<IJobExecutor>(
  "Jobs/UploadFilesJobExecutor",
);

export namespace UploadFilesJobExecutor {
  export type Interface = IJobExecutor;
}
