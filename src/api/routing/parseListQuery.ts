const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 1000;

export interface ListQueryParams {
  limit: number;
  offset: number;
  page: number;
  sortField: string | undefined;
  sortDir: "asc" | "desc";
}

/**
 * Reads a number the caller gave, or the fallback when they gave nothing usable.
 *
 * `parseInt(...) || fallback` cannot tell `?limit=0` from `?limit=` — both are falsy — so an
 * explicit zero silently became the default instead of being clamped like any other number.
 */
function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseListQuery(query: Record<string, string | undefined>): ListQueryParams {
  const limit = Math.min(Math.max(parseNumber(query.limit, DEFAULT_LIMIT), 1), MAX_LIMIT);
  const page = Math.max(parseNumber(query.page, 1), 1);
  const offset = (page - 1) * limit;
  const sortField = query.sortField || undefined;
  const sortDir = query.sortDir === "asc" ? "asc" : "desc";

  return { limit, offset, page, sortField, sortDir };
}

export function getStringFilter(
  query: Record<string, string | undefined>,
  key: string,
): string | undefined {
  const value = query[key];
  return value && value.trim() !== "" ? value.trim() : undefined;
}
