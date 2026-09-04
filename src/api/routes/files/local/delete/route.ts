import { deleteLocalFileRoute } from "~/shared/routes/files.js";
import { DeleteLocalFileService } from "~/shared/node/features/files/local/abstractions/DeleteLocalFileService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const deleteLocalFile = routeFactory(
  deleteLocalFileRoute,
  async ({ params, container, send }) => {
    const service = container.resolve(DeleteLocalFileService);
    const result = await service.execute({ fileName: params.fileName });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.none();
  },
);
