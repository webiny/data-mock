import { makeAutoObservable } from "mobx";
import type { SeedEntry } from "~/shared/types.js";
import { EntriesRepository as Abstraction } from "./abstractions/EntriesRepository.js";

class EntriesRepositoryImpl implements Abstraction.Interface {
  private _entries: SeedEntry[] = [];
  private _total = 0;

  public constructor() {
    makeAutoObservable(this);
  }

  public get entries(): SeedEntry[] {
    return this._entries;
  }

  public get totalEntries(): number {
    return this._total;
  }

  public setEntries(entries: SeedEntry[], total: number): void {
    this._entries = entries;
    this._total = total;
  }

  public clearEntries(environmentId: string): void {
    this._entries = this._entries.filter((e) => e.environmentId !== environmentId);
    this._total = 0;
  }

  public getEntriesByEnvironmentId(environmentId: string): SeedEntry[] {
    return this._entries.filter((e) => e.environmentId === environmentId);
  }
}

export const EntriesRepository = Abstraction.createImplementation({
  implementation: EntriesRepositoryImpl,
  dependencies: [],
});
