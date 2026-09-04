import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEndpointClient } from "../createEndpointClient.js";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CmsManageEndpointClient } from "../abstractions/CmsManageEndpointClient.js";
import { CmsReadEndpointClient } from "../abstractions/CmsReadEndpointClient.js";
import { CmsPreviewEndpointClient } from "../abstractions/CmsPreviewEndpointClient.js";
import { GraphQLEndpointClient } from "../abstractions/GraphQLEndpointClient.js";
import type { HttpClient } from "~/shared/abstractions/HttpClient.js";

function createMockHttpClient() {
  return {
    post: vi.fn<HttpClient.Interface["post"]>(),
  };
}

function createMockResponse(status: number, body: unknown): HttpClient.Response {
  return {
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  };
}

describe("createEndpointClient", () => {
  it("should concatenate baseUrl and path", async () => {
    const mockHttp = createMockHttpClient();
    mockHttp.post.mockResolvedValue(createMockResponse(200, { data: {} }));

    const client = createEndpointClient(mockHttp, "/cms/manage");
    await client.post("https://api.example.com", '{"query":"{}"}', { authorization: "Bearer t" });

    expect(mockHttp.post).toHaveBeenCalledWith(
      "https://api.example.com/cms/manage",
      '{"query":"{}"}',
      { authorization: "Bearer t" },
    );
  });

  it("should pass body and headers through unchanged", async () => {
    const mockHttp = createMockHttpClient();
    mockHttp.post.mockResolvedValue(createMockResponse(200, {}));

    const body = JSON.stringify({ query: "{ listModels { data { modelId } } }", variables: {} });
    const headers = {
      "Content-Type": "application/json",
      authorization: "Bearer test-token",
      "x-tenant": "root",
    };

    const client = createEndpointClient(mockHttp, "/graphql");
    await client.post("https://api.example.com", body, headers);

    expect(mockHttp.post).toHaveBeenCalledWith("https://api.example.com/graphql", body, headers);
  });

  it("should return the HttpClient response", async () => {
    const mockHttp = createMockHttpClient();
    const expectedResponse = createMockResponse(200, { data: { result: "ok" } });
    mockHttp.post.mockResolvedValue(expectedResponse);

    const client = createEndpointClient(mockHttp, "/cms/read");
    const response = await client.post("https://api.example.com", "{}", {});

    expect(response).toBe(expectedResponse);
    expect(response.status).toBe(200);
  });

  it("should propagate errors from HttpClient", async () => {
    const mockHttp = createMockHttpClient();
    mockHttp.post.mockRejectedValue(new Error("Network failure"));

    const client = createEndpointClient(mockHttp, "/cms/manage");

    await expect(client.post("https://api.example.com", "{}", {})).rejects.toThrow(
      "Network failure",
    );
  });

  it("should handle baseUrl with trailing slash", async () => {
    const mockHttp = createMockHttpClient();
    mockHttp.post.mockResolvedValue(createMockResponse(200, {}));

    const client = createEndpointClient(mockHttp, "/cms/preview");
    await client.post("https://api.example.com/", "{}", {});

    expect(mockHttp.post).toHaveBeenCalledWith("https://api.example.com//cms/preview", "{}", {});
  });
});

describe("Endpoint DI resolution", () => {
  let mockHttpClient: HttpClient.Interface & { post: ReturnType<typeof vi.fn> };
  let tc: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
    tc = createTestContainer({ httpClient: mockHttpClient });
  });

  afterEach(() => {
    tc.cleanup();
  });

  it("should resolve CmsManageEndpointClient with /cms/manage path", async () => {
    mockHttpClient.post.mockResolvedValue(createMockResponse(200, {}));

    const client = tc.container.resolve(CmsManageEndpointClient);
    await client.post("https://api.example.com", "{}", {});

    expect(mockHttpClient.post).toHaveBeenCalledWith(
      "https://api.example.com/cms/manage",
      "{}",
      {},
    );
  });

  it("should resolve CmsReadEndpointClient with /cms/read path", async () => {
    mockHttpClient.post.mockResolvedValue(createMockResponse(200, {}));

    const client = tc.container.resolve(CmsReadEndpointClient);
    await client.post("https://api.example.com", "{}", {});

    expect(mockHttpClient.post).toHaveBeenCalledWith("https://api.example.com/cms/read", "{}", {});
  });

  it("should resolve CmsPreviewEndpointClient with /cms/preview path", async () => {
    mockHttpClient.post.mockResolvedValue(createMockResponse(200, {}));

    const client = tc.container.resolve(CmsPreviewEndpointClient);
    await client.post("https://api.example.com", "{}", {});

    expect(mockHttpClient.post).toHaveBeenCalledWith(
      "https://api.example.com/cms/preview",
      "{}",
      {},
    );
  });

  it("should resolve GraphQLEndpointClient with /graphql path", async () => {
    mockHttpClient.post.mockResolvedValue(createMockResponse(200, {}));

    const client = tc.container.resolve(GraphQLEndpointClient);
    await client.post("https://api.example.com", "{}", {});

    expect(mockHttpClient.post).toHaveBeenCalledWith("https://api.example.com/graphql", "{}", {});
  });

  it("should share the same HttpClient across all endpoints", async () => {
    mockHttpClient.post.mockResolvedValue(createMockResponse(200, {}));

    const manage = tc.container.resolve(CmsManageEndpointClient);
    const read = tc.container.resolve(CmsReadEndpointClient);

    await manage.post("https://api.example.com", "{}", {});
    await read.post("https://api.example.com", "{}", {});

    expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
    expect(mockHttpClient.post).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/cms/manage",
      "{}",
      {},
    );
    expect(mockHttpClient.post).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/cms/read",
      "{}",
      {},
    );
  });
});
