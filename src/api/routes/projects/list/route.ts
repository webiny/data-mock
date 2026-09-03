import { listProjectsRoute } from "~/shared/routes/projects.js";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listProjects = routeFactory(listProjectsRoute, async ({ container, send }) => {
  const repository = container.resolve(ProjectRepository);
  const result = await repository.list();

  if (result.isFail()) {
    return send.error(result.error);
  }

  const projects = result.value;
  return send.list("projects", projects, projects.length);
});
