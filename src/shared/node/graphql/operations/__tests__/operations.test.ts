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
            data: [{ id: "g1", name: "Group 1", slug: "group-1", description: "", icon: "" }],
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
            data: [{ modelId: "article", name: "Article", fields: [] }],
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
    it("buildCreateEntryQuery should include model name", () => {
      const query = buildCreateEntryQuery({
        singularApiName: "Article",
        fieldSelection: "title body",
      });
      expect(query).toContain("createArticle");
      expect(query).toContain("ArticleInput");
      expect(query).toContain("title body");
    });

    it("buildCreateRevisionQuery should include createFrom", () => {
      const query = buildCreateRevisionQuery({
        singularApiName: "Article",
        fieldSelection: "title",
      });
      expect(query).toContain("createArticleFrom");
      expect(query).toContain("$revision: ID!");
    });

    it("buildPublishQuery should include publish mutation", () => {
      const query = buildPublishQuery("Article");
      expect(query).toContain("publishArticle");
      expect(query).toContain("$revision: ID!");
    });

    it("buildUnpublishQuery should include unpublish mutation", () => {
      const query = buildUnpublishQuery("Article");
      expect(query).toContain("unpublishArticle");
    });

    it("buildDeleteEntryQuery should include delete mutation", () => {
      const query = buildDeleteEntryQuery("Article");
      expect(query).toContain("deleteArticle");
      expect(query).toContain("$revision: ID!");
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
});
