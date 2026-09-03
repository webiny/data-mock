import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphQLClientImpl } from "../GraphQLClient.js";
import type { HttpClient } from "~/shared/abstractions/HttpClient.js";
import type { ApiGraphQLResultJson } from "../abstractions/GraphQLClient.js";

function createMockHttpClient(): HttpClient.Interface {
  return {
    post: vi.fn(),
  };
}

function createMockResponse(status: number, body: unknown): HttpClient.Response {
  return {
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  };
}

const defaultGetResult = (json: ApiGraphQLResultJson) => ({
  data: json.data["result"] as string,
});

describe("GraphQLClientImpl", () => {
  let httpClient: HttpClient.Interface;
  let client: GraphQLClientImpl;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    client = new GraphQLClientImpl(httpClient, {
      url: "https://api.example.com",
      token: "test-token",
      tenant: "root",
      retries: 0,
      retryMinTimeout: 0,
    });
  });

  describe("query", () => {
    it("should send a POST request with correct headers and body", async () => {
      const responseBody = { data: { result: "hello" } };
      vi.mocked(httpClient.post).mockResolvedValue(createMockResponse(200, responseBody));

      const result = await client.query({
        query: "{ listItems { data } }",
        path: "/cms/manage",
        variables: { limit: 10 },
        getResult: defaultGetResult,
      });

      expect(result.isOk()).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/cms/manage",
        JSON.stringify({
          query: "{ listItems { data } }",
          variables: { limit: 10 },
        }),
        expect.objectContaining({
          "Content-Type": "application/json",
          authorization: "Bearer test-token",
          "x-tenant": "root",
        }),
      );
    });

    it("should return Result.ok with extracted data on success", async () => {
      vi.mocked(httpClient.post).mockResolvedValue(
        createMockResponse(200, { data: { result: "success" } }),
      );

      const result = await client.query({
        query: "{ test }",
        path: "/cms/manage",
        getResult: defaultGetResult,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.data).toBe("success");
      }
    });

    it("should return Result.fail on non-200 status", async () => {
      vi.mocked(httpClient.post).mockResolvedValue(
        createMockResponse(500, "Internal Server Error"),
      );

      const result = await client.query({
        query: "{ test }",
        path: "/cms/manage",
        getResult: defaultGetResult,
      });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("GraphQL/RequestError");
      }
    });

    it("should return Result.fail when all retries are exhausted", async () => {
      vi.mocked(httpClient.post).mockRejectedValue(new Error("Network error"));

      const result = await client.query({
        query: "{ test }",
        path: "/cms/manage",
        getResult: defaultGetResult,
      });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.message).toContain("Network error");
      }
    });
  });

  describe("mutation", () => {
    it("should send mutation and return Result.ok on success", async () => {
      vi.mocked(httpClient.post).mockResolvedValue(
        createMockResponse(200, { data: { result: "created" } }),
      );

      const result = await client.mutation({
        mutation: "mutation { createItem { data } }",
        path: "/cms/manage",
        variables: { name: "test" },
        getResult: defaultGetResult,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.data).toBe("created");
      }
    });
  });

  describe("mutations (batch)", () => {
    it("should chunk variables and execute in batches", async () => {
      vi.mocked(httpClient.post).mockResolvedValue(
        createMockResponse(200, { data: { result: "ok" } }),
      );

      const result = await client.mutations({
        mutation: "mutation { createItem { data } }",
        path: "/cms/manage",
        variables: [{ id: "1" }, { id: "2" }, { id: "3" }],
        atOnce: 2,
        getResult: defaultGetResult,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(3);
      }
      expect(httpClient.post).toHaveBeenCalledTimes(3);
    });

    it("should fail fast when a chunk fails", async () => {
      vi.mocked(httpClient.post)
        .mockResolvedValueOnce(createMockResponse(200, { data: { result: "ok" } }))
        .mockResolvedValueOnce(createMockResponse(500, "error"));

      const result = await client.mutations({
        mutation: "mutation { createItem { data } }",
        path: "/cms/manage",
        variables: [{ id: "1" }, { id: "2" }],
        atOnce: 2,
        getResult: defaultGetResult,
      });

      expect(result.isFail()).toBe(true);
    });
  });

  describe("setTenant", () => {
    it("should update the tenant header for subsequent requests", async () => {
      vi.mocked(httpClient.post).mockResolvedValue(
        createMockResponse(200, { data: { result: "ok" } }),
      );

      client.setTenant("tenant-2");

      await client.query({
        query: "{ test }",
        path: "/cms/manage",
        getResult: defaultGetResult,
      });

      expect(httpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ "x-tenant": "tenant-2" }),
      );
    });
  });
});
