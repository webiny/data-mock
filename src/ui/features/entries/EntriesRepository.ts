import { makeAutoObservable } from "mobx";
import type { SeedEntry } from "~/shared/types.js";
import { EntriesRepository as Abstraction } from "./abstractions/EntriesRepository.js";

class EntriesRepositoryImpl implements Abstraction.Interface {
  private _entries: SeedEntry[] = [];

  public constructor() {
    makeAutoObservable(this);
  }

  public get entries(): SeedEntry[] {
    return this._entries;
  }

  public setEntries(entries: SeedEntry[]): void {
    this._entries = entries;
  }

  public clearEntries(projectId: string): void {
    this._entries = this._entries.filter((e) => e.projectId !== projectId);
  }

  public getEntriesByProjectId(projectId: string): SeedEntry[] {
    return this._entries.filter((e) => e.projectId === projectId);
  }
}

export const EntriesRepository = Abstraction.createImplementation({
  implementation: EntriesRepositoryImpl,
  dependencies: [],
});
