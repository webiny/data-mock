import { listProjectFilesRoute } from "~/shared/routes/files.js";
import { ListProjectFilesRepository } from "~/shared/node/features/files/list/abstractions/ListProjectFilesRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listProjectFiles = routeFactory(
  listProjectFilesRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(ListProjectFilesRepository);
    const result = await repository.execute({ projectId: params.projectId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("files", result.value, result.value.length);
  },
);
