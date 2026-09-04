import { makeAutoObservable } from "mobx";
import type { SyncLog } from "~/shared/types.js";
import { SyncLogsRepository as Abstraction } from "./abstractions/SyncLogsRepository.js";

class SyncLogsRepositoryImpl implements Abstraction.Interface {
  private _logs: SyncLog[] = [];
  private _total = 0;

  public constructor() {
    makeAutoObservable(this);
  }

  public get logs(): SyncLog[] {
    return this._logs;
  }

  public get totalLogs(): number {
    return this._total;
  }

  public setLogs(logs: SyncLog[], total: number): void {
    this._logs = logs;
    this._total = total;
  }

  public addLog(log: SyncLog): void {
    this._logs = [log, ...this._logs];
  }

  public removeLog(id: string): void {
    this._logs = this._logs.filter((log) => log.id !== id);
  }

  public getLogsByProjectId(projectId: string): SyncLog[] {
    return this._logs.filter((log) => log.projectId === projectId);
  }
}

export const SyncLogsRepository = Abstraction.createImplementation({
  implementation: SyncLogsRepositoryImpl,
  dependencies: [],
});
