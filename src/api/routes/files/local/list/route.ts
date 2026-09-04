import { listLocalFilesRoute } from "~/shared/routes/files.js";
import { ListLocalFilesService } from "~/shared/node/features/files/local/abstractions/ListLocalFilesService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listLocalFiles = routeFactory(listLocalFilesRoute, async ({ container, send }) => {
  const service = container.resolve(ListLocalFilesService);
  const result = await service.execute({});

  if (result.isFail()) {
    return send.error(result.error);
  }

  return send.list("files", result.value.files, result.value.files.length);
});
