import { makeAutoObservable } from "mobx";
import type { SyncLog } from "~/shared/types.js";
import { SyncLogsRepository as Abstraction } from "./abstractions/SyncLogsRepository.js";

class SyncLogsRepositoryImpl implements Abstraction.Interface {
  private _logs: SyncLog[] = [];

  public constructor() {
    makeAutoObservable(this);
  }

  public get logs(): SyncLog[] {
    return this._logs;
  }

  public setLogs(logs: SyncLog[]): void {
    this._logs = logs;
  }

  public addLog(log: SyncLog): void {
    this._logs = [log, ...this._logs];
  }

  public getLogsByProjectId(projectId: string): SyncLog[] {
    return this._logs.filter((log) => log.projectId === projectId);
  }
}

export const SyncLogsRepository = Abstraction.createImplementation({
  implementation: SyncLogsRepositoryImpl,
  dependencies: [],
});
