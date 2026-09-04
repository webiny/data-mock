const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 1000;

export interface ListQueryParams {
  limit: number;
  offset: number;
  page: number;
  sortField: string | undefined;
  sortDir: "asc" | "desc";
}

export function parseListQuery(query: Record<string, string | undefined>): ListQueryParams {
  const limit = Math.min(Math.max(parseInt(query.limit ?? "", 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const page = Math.max(parseInt(query.page ?? "", 10) || 1, 1);
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
