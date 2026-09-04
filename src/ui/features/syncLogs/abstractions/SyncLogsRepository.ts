import { createAbstraction } from "@webiny/stdlib";
import type { SyncLog } from "~/shared/types.js";

export interface ISyncLogsRepository {
  readonly logs: SyncLog[];
  readonly totalLogs: number;
  setLogs(logs: SyncLog[], total: number): void;
  addLog(log: SyncLog): void;
  removeLog(id: string): void;
  getLogsByProjectId(projectId: string): SyncLog[];
}

export const SyncLogsRepository = createAbstraction<ISyncLogsRepository>("Ui/SyncLogsRepository");

export namespace SyncLogsRepository {
  export type Interface = ISyncLogsRepository;
}
