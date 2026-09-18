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
    if (body.rootPath !== undefined) {
      input.rootPath = body.rootPath;
    }
    if (body.operationsVersion !== undefined) {
      input.operationsVersion = body.operationsVersion;
    }
    if (body.awsProfile !== undefined) {
      input.awsProfile = body.awsProfile;
    }
    if (body.awsRegion !== undefined) {
      input.awsRegion = body.awsRegion;
    }

    const result = await repository.execute(input);

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("project", result.value);
  },
);
