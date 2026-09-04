import { createAbstraction } from "@webiny/stdlib";

type IFilterType = "text" | "dropdown" | "dropdown-multiple" | "datetime";

interface IFilterDefinition {
  type: IFilterType;
}

interface ISort {
  field: string;
  direction: "asc" | "desc";
}

interface URLListStateConfig {
  filters: Record<string, IFilterDefinition>;
  onChange: () => void;
}

interface IURLListState {
  get(name: string): string;
  getMultiple(name: string): string[];
  getDateTime(name: string): Date | null;
  set(name: string, value: string): void;
  setMultiple(name: string, values: string[]): void;
  setDateTime(name: string, value: Date | null): void;
  setBatch(updates: Record<string, string | null>): void;
  page: number;
  setPage(page: number): void;
  sort: ISort | undefined;
  setSort(field: string, direction: "asc" | "desc"): void;
  clearSort(): void;
}

export interface IURLListStateFactory {
  create(config: URLListStateConfig): IURLListState;
}

export const URLListStateFactory = createAbstraction<IURLListStateFactory>("URLListStateFactory");

export namespace URLListStateFactory {
  export type Interface = IURLListStateFactory;
}

export namespace URLListState {
  export type Interface = IURLListState;
  export type Config = URLListStateConfig;
  export type Sort = ISort;
  export type FilterType = IFilterType;
  export type FilterDefinition = IFilterDefinition;
}
