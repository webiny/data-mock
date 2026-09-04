import { uploadLocalFileRoute } from "~/shared/routes/files.js";
import { SaveLocalFileService } from "~/shared/node/features/files/local/abstractions/SaveLocalFileService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const uploadLocalFile = routeFactory(
  uploadLocalFileRoute,
  async ({ body, container, send }) => {
    const service = container.resolve(SaveLocalFileService);
    const result = await service.execute({
      fileName: body.fileName,
      fileContent: body.fileContent,
    });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("file", result.value, 201);
  },
);
