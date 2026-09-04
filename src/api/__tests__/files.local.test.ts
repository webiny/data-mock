import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { ApiFeature } from "../feature.js";
import { createServer } from "../server.js";
import { registerApiRoutes } from "../routes/index.js";
import type { FastifyInstance } from "fastify";

const IMAGES_DIR = join(process.cwd(), ".webiny", "images");

describe("Local Files API routes", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let app: FastifyInstance;

  beforeEach(async () => {
    tc = createTestContainer();
    ApiFeature.register(tc.container);
    app = await createServer(tc.container, [registerApiRoutes]);
    rmSync(IMAGES_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    await app.close();
    tc.cleanup();
    rmSync(IMAGES_DIR, { recursive: true, force: true });
  });

  describe("GET /api/files/local", () => {
    it("should return an empty list when no local files exist", async () => {
      const response = await app.inject({ method: "GET", url: "/api/files/local" });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.files.items).toEqual([]);
      expect(body.files.total).toBe(0);
    });

    it("should list local files with upload status", async () => {
      mkdirSync(IMAGES_DIR, { recursive: true });
      writeFileSync(join(IMAGES_DIR, "photo.jpg"), "jpg-bytes");

      const response = await app.inject({ method: "GET", url: "/api/files/local" });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.files.total).toBe(1);
      expect(body.files.items[0].fileName).toBe("photo.jpg");
      expect(body.files.items[0].uploadedToProjects).toEqual([]);
    });
  });

  describe("POST /api/files/local/upload", () => {
    it("should save a base64-encoded file and return its metadata", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/files/local/upload",
        payload: {
          fileName: "dropped.png",
          fileContent: Buffer.from("png-bytes").toString("base64"),
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.file.fileName).toBe("dropped.png");
      expect(body.file.fileType).toBe("image/png");
      expect(body.file.fileSize).toBe(Buffer.byteLength("png-bytes"));
    });

    it("should return 400 for a path-traversal file name", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/files/local/upload",
        payload: {
          fileName: "../evil.png",
          fileContent: Buffer.from("x").toString("base64"),
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for invalid body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/files/local/upload",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("Validation/Error");
    });
  });

  describe("DELETE /api/files/local/:fileName", () => {
    it("should delete a file and return 204", async () => {
      mkdirSync(IMAGES_DIR, { recursive: true });
      writeFileSync(join(IMAGES_DIR, "remove-me.jpg"), "bytes");

      const response = await app.inject({
        method: "DELETE",
        url: "/api/files/local/remove-me.jpg",
      });

      expect(response.statusCode).toBe(204);

      const listResponse = await app.inject({ method: "GET", url: "/api/files/local" });
      expect(listResponse.json().files.total).toBe(0);
    });

    it("should reject unsafe file names with 400", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/files/local/..%2F..%2Fetc%2Fpasswd",
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/files/local/:fileName/content", () => {
    it("should serve the raw file bytes with the correct content type", async () => {
      mkdirSync(IMAGES_DIR, { recursive: true });
      writeFileSync(join(IMAGES_DIR, "thumb.jpg"), "jpg-bytes");

      const response = await app.inject({
        method: "GET",
        url: "/api/files/local/thumb.jpg/content",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("image/jpeg");
      expect(response.body).toBe("jpg-bytes");
    });

    it("should return 404 when the file does not exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/files/local/missing.jpg/content",
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 400 for a path-traversal file name", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/files/local/..%2F..%2Fetc%2Fpasswd/content",
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /api/projects/:projectId/files/upload-global", () => {
    it("should upload unlinked local images to the project's file pool", async () => {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Upload Global Project",
          apiUrl: "https://api.example.com",
          apiToken: "token",
          tenant: "root",
        },
      });
      const projectId = createResponse.json().project.id;

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/files/upload-global`,
        payload: { tenant: "root" },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.result.uploaded).toBe(0);
      expect(body.result.files).toEqual([]);
    });

    it("should return 400 for invalid body", async () => {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Another Project",
          apiUrl: "https://api.example.com",
          apiToken: "token",
        },
      });
      const projectId = createResponse.json().project.id;

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/files/upload-global`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
