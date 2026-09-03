import { createProjectRoute } from "~/shared/routes/projects.js";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";
import type { CreateProjectBody } from "~/shared/responses/projects.js";

export const createProject = routeFactory<Record<string, never>, CreateProjectBody>(
  createProjectRoute,
  async ({ body, container, send }) => {
    const repository = container.resolve(ProjectRepository);
    const result = await repository.create(body);

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("project", result.value, 201);
  },
);
