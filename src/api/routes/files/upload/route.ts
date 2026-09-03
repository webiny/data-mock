import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { uploadProjectFileRoute } from "~/shared/routes/files.js";
import { FileUploadService } from "~/shared/node/features/files/upload/abstractions/FileUploadService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const uploadProjectFile = routeFactory(
  uploadProjectFileRoute,
  async ({ params, body, container, send }) => {
    const tmpDir = join(process.cwd(), ".webiny", "tmp");
    mkdirSync(tmpDir, { recursive: true });
    const tmpPath = join(tmpDir, `${randomUUID()}-${body.fileName}`);

    try {
      const fileBuffer = Buffer.from(body.fileContent, "base64");
      writeFileSync(tmpPath, fileBuffer);

      const service = container.resolve(FileUploadService);
      const result = await service.execute({
        projectId: params.projectId,
        tenant: body.tenant,
        filePath: tmpPath,
      });

      if (result.isFail()) {
        return send.error(result.error);
      }

      return send.one("file", result.value.file, 201);
    } finally {
      try {
        const { unlinkSync } = await import("node:fs");
        unlinkSync(tmpPath);
      } catch {
        // ignore cleanup errors
      }
    }
  },
);
