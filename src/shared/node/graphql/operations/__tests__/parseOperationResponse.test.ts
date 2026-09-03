import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseOperationResponse } from "../parseOperationResponse.js";
import type { ApiGraphQLResultJson } from "../../abstractions/GraphQLClient.js";

function makeJson(data: Record<string, unknown>): ApiGraphQLResultJson {
  return { data } as ApiGraphQLResultJson;
}

const testSchema = z.array(z.object({ id: z.string(), name: z.string() }).passthrough());

describe("parseOperationResponse", () => {
  it("should return error when response key is missing (named key)", () => {
    const result = parseOperationResponse(makeJson({}), "listItems", testSchema);
    expect(result.error).toBeTruthy();
    expect(result.error!.message).toBe("Unexpected response shape");
  });

  it("should return error when json.data is empty (null key / first-key mode)", () => {
    const result = parseOperationResponse(makeJson({}), null, testSchema);
    expect(result.error).toBeTruthy();
    expect(result.error!.message).toBe("Unexpected response shape");
  });

  it("should return GraphQL error when present", () => {
    const result = parseOperationResponse(
      makeJson({ listItems: { error: { message: "Not authorized", code: "AUTH" } } }),
      "listItems",
      testSchema,
    );
    expect(result.error).toBeTruthy();
    expect(result.error!.message).toBe("Not authorized");
    expect(result.error!.code).toBe("AUTH");
  });

  it("should return validation error when data does not match schema", () => {
    const result = parseOperationResponse(
      makeJson({ listItems: { data: "not-an-array" } }),
      "listItems",
      testSchema,
    );
    expect(result.error).toBeTruthy();
    expect(result.error!.code).toBe("VALIDATION");
    expect(result.error!.message).toContain("Invalid listItems response");
  });

  it("should return parsed data on success with named key", () => {
    const result = parseOperationResponse(
      makeJson({
        listItems: {
          data: [
            { id: "1", name: "Item 1" },
            { id: "2", name: "Item 2" },
          ],
        },
      }),
      "listItems",
      testSchema,
    );
    expect(result.data).toEqual([
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
    ]);
  });

  it("should return parsed data using first key when responseKey is null", () => {
    const result = parseOperationResponse(
      makeJson({
        createArticle: { data: [{ id: "a1", name: "Article" }] },
      }),
      null,
      testSchema,
    );
    expect(result.data).toEqual([{ id: "a1", name: "Article" }]);
  });

  it("should apply transform function", () => {
    const result = parseOperationResponse(
      makeJson({
        listItems: { data: [{ id: "1", name: "Item" }] },
      }),
      "listItems",
      testSchema,
      (data) => data.map((d) => d.id),
    );
    expect(result.data).toEqual(["1"]);
  });

  it("should preserve passthrough fields", () => {
    const result = parseOperationResponse(
      makeJson({
        listItems: { data: [{ id: "1", name: "Item", extra: "field" }] },
      }),
      "listItems",
      testSchema,
    );
    const items = result.data as Array<{ id: string; name: string; extra?: string }>;
    expect(items[0]!.extra).toBe("field");
  });
});
