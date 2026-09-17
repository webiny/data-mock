import { describe, it, expect } from "vitest";
import { getStringFilter, parseListQuery } from "../parseListQuery.js";

describe("parseListQuery", () => {
  it("defaults when the caller asks for nothing", () => {
    expect(parseListQuery({})).toEqual({
      limit: 25,
      offset: 0,
      page: 1,
      sortField: undefined,
      sortDir: "desc",
    });
  });

  it("reads the limit, page and sort the caller gave", () => {
    const parsed = parseListQuery({
      limit: "10",
      page: "3",
      sortField: "createdAt",
      sortDir: "asc",
    });

    expect(parsed).toEqual({
      limit: 10,
      offset: 20,
      page: 3,
      sortField: "createdAt",
      sortDir: "asc",
    });
  });

  it("caps a limit nobody should be asking for", () => {
    expect(parseListQuery({ limit: "1000000" }).limit).toBe(1000);
  });

  it("clamps an explicit zero rather than reading it as absent", () => {
    // `parseInt(...) || DEFAULT` cannot tell `?limit=0` from `?limit=`, so an explicit zero used
    // to come back as the default page size instead of being clamped like any other number.
    expect(parseListQuery({ limit: "0" }).limit).toBe(1);
    expect(parseListQuery({ page: "0" }).page).toBe(1);
  });

  it("clamps a negative to the same floor", () => {
    expect(parseListQuery({ limit: "-5" }).limit).toBe(1);
    expect(parseListQuery({ page: "-5" }).page).toBe(1);
  });

  it("falls back when the value is not a number at all", () => {
    expect(parseListQuery({ limit: "abc", page: "abc" })).toMatchObject({ limit: 25, page: 1 });
  });

  it("sorts descending unless asc is asked for by name", () => {
    expect(parseListQuery({ sortDir: "sideways" }).sortDir).toBe("desc");
  });
});

describe("getStringFilter", () => {
  it("returns a trimmed value", () => {
    expect(getStringFilter({ tenant: "  root  " }, "tenant")).toBe("root");
  });

  it("treats an absent, empty or whitespace-only filter as unset", () => {
    expect(getStringFilter({}, "tenant")).toBeUndefined();
    expect(getStringFilter({ tenant: "" }, "tenant")).toBeUndefined();
    expect(getStringFilter({ tenant: "   " }, "tenant")).toBeUndefined();
  });
});
