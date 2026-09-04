import { createAbstraction } from "@webiny/stdlib";
import type { SeedEntry } from "~/shared/types.js";

export interface IEntriesRepository {
  readonly entries: SeedEntry[];
  readonly totalEntries: number;
  setEntries(entries: SeedEntry[], total: number): void;
  clearEntries(projectId: string): void;
  getEntriesByProjectId(projectId: string): SeedEntry[];
}

export const EntriesRepository = createAbstraction<IEntriesRepository>("Ui/EntriesRepository");

export namespace EntriesRepository {
  export type Interface = IEntriesRepository;
}
