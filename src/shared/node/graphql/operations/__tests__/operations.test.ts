import { describe, it, expect } from "vitest";
import { listContentModelGroups } from "../base/listContentModelGroups.js";
import { listContentModels } from "../base/listContentModels.js";
import { listTenants } from "../base/listTenants.js";
import {
  createRevisionOperation,
  publishEntryOperation,
  unpublishEntryOperation,
  deleteEntryOperation,
  buildCreateRevisionQuery,
  buildPublishQuery,
  buildUnpublishQuery,
  buildDeleteEntryQuery,
} from "../base/revisionOperations.js";
import { createContentEntry, buildCreateEntryQuery } from "../base/createContentEntry.js";
import type { ApiGraphQLResultJson } from "../../abstractions/GraphQLClient.js";

function makeJson(data: Record<string, unknown>): ApiGraphQLResultJson {
  return { data } as ApiGraphQLResultJson;
}

describe("GraphQL Operations", () => {
  describe("listContentModelGroups", () => {
    it("should parse success response", () => {
      const result = listContentModelGroups.getResult(
        makeJson({
          listContentModelGroups: {
            data: [
              {
                id: "g1",
                name: "Group 1",
                slug: "group-1",
                description: null,
                icon: { type: "icon", name: "fas-folder" },
              },
            ],
          },
        }),
      );
      expect("data" in result && result.data).toBeTruthy();
    });

    it("should return error for missing response key", () => {
      const result = listContentModelGroups.getResult(makeJson({}));
      expect("error" in result && result.error).toBeTruthy();
      expect(result.error!.message).toBe("Unexpected response shape");
    });

    it("should return error from GraphQL error", () => {
      const result = listContentModelGroups.getResult(
        makeJson({
          listContentModelGroups: {
            error: { message: "Not authorized", code: "AUTH" },
          },
        }),
      );
      expect("error" in result && result.error).toBeTruthy();
      expect(result.error!.message).toBe("Not authorized");
    });
  });

  describe("listContentModels", () => {
    it("should parse success response", () => {
      const result = listContentModels.getResult(
        makeJson({
          listContentModels: {
            data: [
              {
                modelId: "article",
                name: "Article",
                singularApiName: "Article",
                pluralApiName: "Articles",
                description: null,
                group: "blog",
                tags: [],
                plugin: false,
                fields: [],
              },
            ],
          },
        }),
      );
      expect("data" in result && result.data).toBeTruthy();
    });

    it("should return error for missing response key", () => {
      const result = listContentModels.getResult(makeJson({}));
      expect("error" in result && result.error).toBeTruthy();
    });

    it("should return GraphQL error", () => {
      const result = listContentModels.getResult(
        makeJson({
          listContentModels: {
            error: { message: "Forbidden", code: "FORBIDDEN" },
          },
        }),
      );
      expect(result.error!.message).toBe("Forbidden");
    });
  });

  describe("listTenants", () => {
    it("should parse tenant entries into tenant format", () => {
      const result = listTenants.getResult(
        makeJson({
          listTenants: {
            data: [
              { id: "root", values: { name: "Root" } },
              { id: "t1", values: { name: "Tenant 1" } },
            ],
          },
        }),
      );
      expect("data" in result && result.data).toBeTruthy();
      const tenants = result.data as Array<{ id: string; name: string }>;
      expect(tenants).toHaveLength(2);
      expect(tenants[0]).toEqual({ id: "root", name: "Root" });
    });

    it("should return error for missing response key", () => {
      const result = listTenants.getResult(makeJson({}));
      expect("error" in result && result.error).toBeTruthy();
    });
  });

  describe("createContentEntry", () => {
    it("should parse success response from first key", () => {
      const result = createContentEntry.getResult(
        makeJson({
          createArticle: {
            data: { id: "abc#0001", entryId: "abc" },
          },
        }),
      );
      expect("data" in result && result.data).toBeTruthy();
    });

    it("should return error for empty data", () => {
      const result = createContentEntry.getResult(makeJson({}));
      expect("error" in result && result.error).toBeTruthy();
    });

    it("should return GraphQL error", () => {
      const result = createContentEntry.getResult(
        makeJson({
          createArticle: {
            error: { message: "Validation failed", code: "VALIDATION" },
          },
        }),
      );
      expect(result.error!.message).toBe("Validation failed");
    });
  });

  describe("revisionOperations", () => {
    it("createRevisionOperation should parse success response", () => {
      const result = createRevisionOperation.getResult(
        makeJson({
          createArticleFrom: {
            data: { id: "abc#0002", entryId: "abc" },
          },
        }),
      );
      expect("data" in result && result.data).toBeTruthy();
    });

    it("publishEntryOperation should parse success response", () => {
      const result = publishEntryOperation.getResult(
        makeJson({
          publishArticle: {
            data: { id: "abc#0001", entryId: "abc" },
          },
        }),
      );
      expect("data" in result && result.data).toBeTruthy();
    });

    it("unpublishEntryOperation should parse success response", () => {
      const result = unpublishEntryOperation.getResult(
        makeJson({
          unpublishArticle: {
            data: { id: "abc#0001", entryId: "abc" },
          },
        }),
      );
      expect("data" in result && result.data).toBeTruthy();
    });

    it("should return error for empty data", () => {
      const result = createRevisionOperation.getResult(makeJson({}));
      expect("error" in result && result.error).toBeTruthy();
      expect(result.error!.message).toBe("Unexpected response shape");
    });

    it("should return GraphQL error", () => {
      const result = publishEntryOperation.getResult(
        makeJson({
          publishArticle: {
            error: { message: "Cannot publish", code: "PUBLISH_ERROR" },
          },
        }),
      );
      expect(result.error!.message).toBe("Cannot publish");
    });
  });

  describe("Query builders", () => {
    it("buildCreateEntryQuery should return query, responseKey, and dataSchema", () => {
      const result = buildCreateEntryQuery({
        singularApiName: "Article",
        fieldSelection: "title body",
      });
      expect(result.query).toContain("createArticle");
      expect(result.query).toContain("ArticleInput");
      expect(result.query).toContain("title body");
      expect(result.responseKey).toBe("createArticle");
      expect(result.dataSchema).toBeDefined();
    });

    it("buildCreateRevisionQuery should return query with createFrom", () => {
      const result = buildCreateRevisionQuery({
        singularApiName: "Article",
        fieldSelection: "title",
      });
      expect(result.query).toContain("createArticleFrom");
      expect(result.query).toContain("$revision: ID!");
      expect(result.responseKey).toBe("createArticleFrom");
      expect(result.dataSchema).toBeDefined();
    });

    it("buildPublishQuery should return query with publish mutation", () => {
      const result = buildPublishQuery("Article");
      expect(result.query).toContain("publishArticle");
      expect(result.query).toContain("$revision: ID!");
      expect(result.responseKey).toBe("publishArticle");
    });

    it("buildUnpublishQuery should return query with unpublish mutation", () => {
      const result = buildUnpublishQuery("Article");
      expect(result.query).toContain("unpublishArticle");
      expect(result.responseKey).toBe("unpublishArticle");
    });

    it("buildDeleteEntryQuery should return query with delete mutation", () => {
      const result = buildDeleteEntryQuery("Article");
      expect(result.query).toContain("deleteArticle");
      expect(result.query).toContain("$revision: ID!");
      expect(result.responseKey).toBe("deleteArticle");
    });

    it("deleteEntryOperation should parse success response", () => {
      const result = deleteEntryOperation.getResult(
        makeJson({
          deleteArticle: {
            data: true,
          },
        }),
      );
      expect("data" in result && result.data).toBeTruthy();
    });
  });

  describe("Zod validation on revision operations", () => {
    it("createRevisionOperation should reject invalid data shape", () => {
      const result = createRevisionOperation.getResult(
        makeJson({
          createArticleFrom: {
            data: { notAnId: 123 },
          },
        }),
      );
      expect(result.error).toBeTruthy();
      expect(result.error!.code).toBe("VALIDATION");
    });

    it("publishEntryOperation should reject invalid data shape", () => {
      const result = publishEntryOperation.getResult(
        makeJson({
          publishArticle: {
            data: "not-an-object",
          },
        }),
      );
      expect(result.error).toBeTruthy();
      expect(result.error!.code).toBe("VALIDATION");
    });

    it("deleteEntryOperation should reject non-boolean data", () => {
      const result = deleteEntryOperation.getResult(
        makeJson({
          deleteArticle: {
            data: { unexpected: "object" },
          },
        }),
      );
      expect(result.error).toBeTruthy();
      expect(result.error!.code).toBe("VALIDATION");
    });
  });
});
