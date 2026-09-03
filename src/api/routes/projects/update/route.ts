import { updateProjectRoute } from "~/shared/routes/projects.js";
import { UpdateProjectRepository } from "~/shared/node/features/projects/update/abstractions/UpdateProjectRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const updateProject = routeFactory(
  updateProjectRoute,
  async ({ params, body, container, send }) => {
    const repository = container.resolve(UpdateProjectRepository);
    const input: UpdateProjectRepository.Input = { id: params.id };
    if (body.name !== undefined) {
      input.name = body.name;
    }
    if (body.apiUrl !== undefined) {
      input.apiUrl = body.apiUrl;
    }
    if (body.apiToken !== undefined) {
      input.apiToken = body.apiToken;
    }
    if (body.tenant !== undefined) {
      input.tenant = body.tenant;
    }
    if (body.webinyVersion !== undefined) {
      input.webinyVersion = body.webinyVersion;
    }

    const result = await repository.execute(input);

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("project", result.value);
  },
);
