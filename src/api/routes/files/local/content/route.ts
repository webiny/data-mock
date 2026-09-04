import { existsSync, readFileSync, statSync } from "node:fs";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  isSafeLocalFileName,
  resolveLocalFilePath,
  guessLocalFileContentType,
} from "~/shared/node/features/files/local/localFilePaths.js";
import type { RouteRegistrar } from "~/api/routing/types.js";

const paramsSchema = z.object({ fileName: z.string() });

export const serveLocalFileContent: RouteRegistrar = async (app: FastifyInstance) => {
  app.get("/api/files/local/:fileName/content", async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params);

    if (!parsedParams.success || !isSafeLocalFileName(parsedParams.data.fileName)) {
      await reply.status(400).send({
        error: { code: "Validation/Error", message: "Invalid file name." },
      });
      return;
    }

    const { fileName } = parsedParams.data;
    const filePath = resolveLocalFilePath(fileName);

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      await reply.status(404).send({
        error: { code: "NotFound", message: `File "${fileName}" not found.` },
      });
      return;
    }

    const contentType = guessLocalFileContentType(fileName);
    const fileBuffer = readFileSync(filePath);
    await reply.type(contentType).send(fileBuffer);
  });
};
