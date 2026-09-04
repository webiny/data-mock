import { uploadGlobalFilesRoute } from "~/shared/routes/files.js";
import { UploadGlobalFilesToProjectService } from "~/shared/node/features/files/pool/abstractions/UploadGlobalFilesToProjectService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const uploadGlobalFiles = routeFactory(
  uploadGlobalFilesRoute,
  async ({ params, body, container, send }) => {
    const service = container.resolve(UploadGlobalFilesToProjectService);
    const result = await service.execute({
      projectId: params.projectId,
      tenant: body.tenant,
    });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("result", result.value, 201);
  },
);
