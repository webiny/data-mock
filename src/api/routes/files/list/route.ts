import { listProjectFilesRoute } from "~/shared/routes/files.js";
import { ListProjectFilesRepository } from "~/shared/node/features/files/list/abstractions/ListProjectFilesRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";
import { parseListQuery, getStringFilter } from "~/api/routing/parseListQuery.js";

export const listProjectFiles = routeFactory(
  listProjectFilesRoute,
  async ({ params, query, container, send }) => {
    const { limit, offset, sortField, sortDir } = parseListQuery(query);

    const input: ListProjectFilesRepository.Input = {
      projectId: params.projectId,
      limit,
      offset,
      sortDir,
    };
    if (sortField) {
      input.sortField = sortField;
    }
    const tenant = getStringFilter(query, "tenant");
    if (tenant) {
      input.tenant = tenant;
    }
    const fileType = getStringFilter(query, "fileType");
    if (fileType) {
      input.fileType = fileType;
    }

    const repository = container.resolve(ListProjectFilesRepository);
    const result = await repository.execute(input);

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("files", result.value.files, result.value.total);
  },
);
