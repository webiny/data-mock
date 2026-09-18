import { describe, it, expect } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { OperationRegistry } from "../abstractions/OperationRegistry.js";
import { listContentEntries, buildListEntriesQuery } from "../base/listContentEntries.js";
import type { ApiGraphQLResultJson } from "../../abstractions/GraphQLClient.js";

function makeJson(data: Record<string, unknown> | null): ApiGraphQLResultJson {
  return { data } as ApiGraphQLResultJson;
}

function makeJsonWithErrors(
  data: Record<string, unknown> | null,
  errors: Array<Record<string, unknown>>,
): ApiGraphQLResultJson {
  return { data, errors } as ApiGraphQLResultJson;
}

const validEntry = { id: "abc#0001", entryId: "abc", values: { title: "Hello" } };
const validMeta = { totalCount: 1, hasMoreItems: false, cursor: null };

describe("listContentEntries", () => {
  describe("registration", () => {
    it("resolves from the operation registry", () => {
      const tc = createTestContainer();
      const registry = tc.container.resolve(OperationRegistry);

      const op = registry.resolve("listContentEntries", "6.0.0");
      expect(op.name).toBe("listContentEntries");
      expect(op.path).toBe("/cms/manage");
      tc.cleanup();
    });
  });

  describe("getVariables (outgoing request)", () => {
    it("defaults limit to 1000 and after to null when neither is provided", () => {
      const variables = listContentEntries.getVariables!({
        pluralApiName: "Articles",
        fieldSelection: "title",
      });
      expect(variables).toEqual({ limit: 1000, after: null });
    });

    it("uses the provided limit and after values", () => {
      const variables = listContentEntries.getVariables!({
        pluralApiName: "Articles",
        fieldSelection: "title",
        limit: 50,
        after: "cursor-1",
      });
      expect(variables).toEqual({ limit: 50, after: "cursor-1" });
    });

    it("keeps after as null when explicitly passed as null", () => {
      const variables = listContentEntries.getVariables!({
        pluralApiName: "Articles",
        fieldSelection: "title",
        limit: 20,
        after: null,
      });
      expect(variables).toEqual({ limit: 20, after: null });
    });

    it("falls back to default limit when only after is provided", () => {
      const variables = listContentEntries.getVariables!({
        pluralApiName: "Articles",
        fieldSelection: "title",
        after: "cursor-2",
      });
      expect(variables).toEqual({ limit: 1000, after: "cursor-2" });
    });
  });

  describe("buildListEntriesQuery (outgoing request shape)", () => {
    it("builds a query named after the plural api name with the field selection inlined", () => {
      const result = buildListEntriesQuery({
        pluralApiName: "Articles",
        fieldSelection: "title\n            body",
      });

      expect(result.responseKey).toBe("listArticles");
      expect(result.query).toContain("query ListEntries($limit: Int, $after: String)");
      expect(result.query).toContain("listArticles(limit: $limit, after: $after)");
      expect(result.query).toContain("title\n            body");
      expect(result.query).toContain("totalCount");
      expect(result.query).toContain("hasMoreItems");
      expect(result.query).toContain("cursor");
      expect(result.query).toContain("error {");
      expect(result.dataSchema).toBeDefined();
    });

    it("derives the operation name from a different plural api name", () => {
      const result = buildListEntriesQuery({
        pluralApiName: "BlogPosts",
        fieldSelection: "slug",
      });

      expect(result.responseKey).toBe("listBlogPosts");
      expect(result.query).toContain("listBlogPosts(limit: $limit, after: $after)");
    });

    it("produces a dataSchema that accepts an array of passthrough entries", () => {
      const result = buildListEntriesQuery({
        pluralApiName: "Articles",
        fieldSelection: "title",
      });

      const parsed = result.dataSchema.safeParse([{ id: "1", extra: "field" }]);
      expect(parsed.success).toBe(true);
    });
  });

  describe("getResult (incoming response mapping)", () => {
    it("returns parsed data and meta on a successful response", () => {
      const result = listContentEntries.getResult(
        makeJson({
          listArticles: {
            data: [validEntry],
            meta: validMeta,
          },
        }),
      );

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ data: [validEntry], meta: validMeta });
    });

    it("returns an empty data array when the entry list is empty", () => {
      const result = listContentEntries.getResult(
        makeJson({
          listArticles: {
            data: [],
            meta: { totalCount: 0, hasMoreItems: false, cursor: null },
          },
        }),
      );

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({
        data: [],
        meta: { totalCount: 0, hasMoreItems: false, cursor: null },
      });
    });

    it("returns a cursor string when there are more items", () => {
      const result = listContentEntries.getResult(
        makeJson({
          listArticles: {
            data: [validEntry],
            meta: { totalCount: 10, hasMoreItems: true, cursor: "next-cursor" },
          },
        }),
      );

      expect(result.data).toEqual({
        data: [validEntry],
        meta: { totalCount: 10, hasMoreItems: true, cursor: "next-cursor" },
      });
    });

    it("returns a GRAPHQL_ERROR using the first error message when json.data is null", () => {
      const result = listContentEntries.getResult(
        makeJsonWithErrors(null, [{ message: "Cannot query field on type" }]),
      );

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        message: "Cannot query field on type",
        code: "GRAPHQL_ERROR",
      });
    });

    it("falls back to a generic error message when the GraphQL error has no message", () => {
      const result = listContentEntries.getResult(makeJsonWithErrors(null, [{ code: "X" }]));

      expect(result.error).toEqual({ message: "GraphQL error", code: "GRAPHQL_ERROR" });
    });

    it("returns a generic message when json.data is null and errors is an empty array", () => {
      const result = listContentEntries.getResult(makeJsonWithErrors(null, []));

      expect(result.error).toEqual({
        message: "Unexpected response: data is null",
        code: "GRAPHQL_ERROR",
      });
    });

    it("returns a generic message when json.data is null and errors is absent", () => {
      const result = listContentEntries.getResult(makeJson(null));

      expect(result.error).toEqual({
        message: "Unexpected response: data is null",
        code: "GRAPHQL_ERROR",
      });
    });

    it("returns UNKNOWN when json.data has no keys", () => {
      const result = listContentEntries.getResult(makeJson({}));

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        message: "Unexpected response shape",
        code: "UNKNOWN",
      });
    });

    it("returns the nested error object as-is when the response key carries an error", () => {
      const result = listContentEntries.getResult(
        makeJson({
          listArticles: {
            error: { message: "Not authorized", code: "AUTH", data: { reason: "forbidden" } },
          },
        }),
      );

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        message: "Not authorized",
        code: "AUTH",
        data: { reason: "forbidden" },
      });
    });

    it("returns a VALIDATION error when data is not an array", () => {
      const result = listContentEntries.getResult(
        makeJson({
          listArticles: {
            data: "not-an-array",
            meta: validMeta,
          },
        }),
      );

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("VALIDATION");
      expect(result.error?.message).toContain("Invalid list entries data:");
    });

    it("returns a VALIDATION error when data is missing entirely (malformed payload)", () => {
      const result = listContentEntries.getResult(
        makeJson({
          listArticles: {
            meta: validMeta,
          },
        }),
      );

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("VALIDATION");
      expect(result.error?.message).toContain("Invalid list entries data:");
    });

    it("returns a VALIDATION error when meta is missing required fields", () => {
      const result = listContentEntries.getResult(
        makeJson({
          listArticles: {
            data: [validEntry],
            meta: { totalCount: 1 },
          },
        }),
      );

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("VALIDATION");
      expect(result.error?.message).toContain("Invalid list entries meta:");
    });

    it("returns a VALIDATION error when meta has the wrong types", () => {
      const result = listContentEntries.getResult(
        makeJson({
          listArticles: {
            data: [validEntry],
            meta: { totalCount: "one", hasMoreItems: false, cursor: null },
          },
        }),
      );

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("VALIDATION");
      expect(result.error?.message).toContain("Invalid list entries meta:");
    });

    it("returns a VALIDATION error when meta is missing entirely (malformed payload)", () => {
      const result = listContentEntries.getResult(
        makeJson({
          listArticles: {
            data: [validEntry],
          },
        }),
      );

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("VALIDATION");
      expect(result.error?.message).toContain("Invalid list entries meta:");
    });
  });
});
