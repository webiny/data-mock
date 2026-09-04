import { makeAutoObservable } from "mobx";
import { URLListStateFactory as Abstraction } from "./abstractions/URLListState.js";
import type { URLListState } from "./abstractions/URLListState.js";
import { getSearchParams, navigateWithQuery } from "./Router.js";

const RESERVED_KEYS = new Set(["page", "sortField", "sortDir"]);

class URLListStateImpl implements URLListState.Interface {
  private filters = new Map<string, string>();
  private multiFilters = new Map<string, string[]>();
  private dateTimeFilters = new Map<string, string>();
  private currentPage = 1;
  private currentSort: URLListState.Sort | undefined = undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  public constructor(private readonly config: URLListState.Config) {
    this.initializeFromURL();
    makeAutoObservable(this);
  }

  public get(name: string): string {
    return this.filters.get(name) ?? "";
  }

  public getMultiple(name: string): string[] {
    return this.multiFilters.get(name) ?? [];
  }

  public getDateTime(name: string): Date | null {
    const value = this.dateTimeFilters.get(name);
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  public set(name: string, value: string): void {
    if (value === "") {
      this.filters.delete(name);
    } else {
      this.filters.set(name, value);
    }
    this.currentPage = 1;
    const filterDefinition = this.config.filters[name];
    if (filterDefinition && filterDefinition.type === "text") {
      this.debouncedUpdateURL();
    } else {
      this.updateURL();
    }
    this.config.onChange();
  }

  public setMultiple(name: string, values: string[]): void {
    this.multiFilters.set(name, values);
    this.currentPage = 1;
    this.updateURL();
    this.config.onChange();
  }

  public setDateTime(name: string, value: Date | null): void {
    if (value) {
      this.dateTimeFilters.set(name, value.toISOString());
    } else {
      this.dateTimeFilters.delete(name);
    }
    this.currentPage = 1;
    this.updateURL();
    this.config.onChange();
  }

  public setBatch(updates: Record<string, string | null>): void {
    for (const [name, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        this.filters.delete(name);
        this.dateTimeFilters.delete(name);
        this.multiFilters.delete(name);
      } else {
        const filterDefinition = this.config.filters[name];
        if (filterDefinition) {
          switch (filterDefinition.type) {
            case "datetime":
              this.dateTimeFilters.set(name, value);
              break;
            case "dropdown-multiple":
              this.multiFilters.set(name, value.split(","));
              break;
            default:
              this.filters.set(name, value);
              break;
          }
        } else {
          this.filters.set(name, value);
        }
      }
    }
    this.currentPage = 1;
    this.updateURL();
    this.config.onChange();
  }

  public get page(): number {
    return this.currentPage;
  }

  public setPage(page: number): void {
    this.currentPage = Math.max(1, page);
    this.updateURL();
    this.config.onChange();
  }

  public get sort(): URLListState.Sort | undefined {
    return this.currentSort;
  }

  public setSort(field: string, direction: "asc" | "desc"): void {
    this.currentSort = { field, direction };
    this.updateURL();
    this.config.onChange();
  }

  public clearSort(): void {
    this.currentSort = undefined;
    this.updateURL();
    this.config.onChange();
  }

  private initializeFromURL(): void {
    const search = getSearchParams();

    for (const [name, definition] of Object.entries(this.config.filters)) {
      const value = search.get(name);
      if (!value) {
        continue;
      }
      switch (definition.type) {
        case "text":
        case "dropdown":
          this.filters.set(name, value);
          break;
        case "dropdown-multiple":
          this.multiFilters.set(name, value.split(","));
          break;
        case "datetime":
          this.dateTimeFilters.set(name, value);
          break;
      }
    }

    const pageParam = search.get("page");
    if (pageParam) {
      this.currentPage = Math.max(1, Number(pageParam) || 1);
    }

    const sortField = search.get("sortField");
    const sortDir = search.get("sortDir");
    if (sortField) {
      this.currentSort = {
        field: sortField,
        direction: sortDir === "desc" ? "desc" : "asc",
      };
    }
  }

  private buildQueryParams(): Record<string, string | null> {
    const result: Record<string, string | null> = {};

    for (const name of Object.keys(this.config.filters)) {
      result[name] = null;
    }
    for (const key of RESERVED_KEYS) {
      result[key] = null;
    }

    for (const [name, value] of this.filters) {
      if (value) {
        result[name] = value;
      }
    }

    for (const [name, values] of this.multiFilters) {
      if (values.length > 0) {
        result[name] = values.join(",");
      }
    }

    for (const [name, value] of this.dateTimeFilters) {
      if (value) {
        result[name] = value;
      }
    }

    if (this.currentPage > 1) {
      result["page"] = String(this.currentPage);
    }

    if (this.currentSort) {
      result["sortField"] = this.currentSort.field;
      result["sortDir"] = this.currentSort.direction;
    }

    return result;
  }

  private updateURL(): void {
    navigateWithQuery(this.buildQueryParams());
  }

  private debouncedUpdateURL(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.updateURL();
      this.debounceTimer = undefined;
    }, 300);
  }
}

class URLListStateFactoryImpl implements Abstraction.Interface {
  public create(config: URLListState.Config): URLListState.Interface {
    return new URLListStateImpl(config);
  }
}

export const URLListStateFactory = Abstraction.createImplementation({
  implementation: URLListStateFactoryImpl,
  dependencies: [],
});
