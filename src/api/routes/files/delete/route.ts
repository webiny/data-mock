import { deleteProjectFileRoute } from "~/shared/routes/files.js";
import { DeleteProjectFileRepository } from "~/shared/node/features/files/delete/abstractions/DeleteProjectFileRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const deleteProjectFile = routeFactory(
  deleteProjectFileRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(DeleteProjectFileRepository);
    const result = await repository.execute({ id: params.fileId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.none();
  },
);
