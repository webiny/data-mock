import type { FastifyInstance } from "fastify";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import "~/api/types.js";

export async function listProjectsRoute(app: FastifyInstance): Promise<void> {
  app.get("/api/projects", async (request, reply) => {
    const repository = request.container.resolve(ProjectRepository);
    const result = await repository.list();

    if (result.isFail()) {
      return reply
        .code(500)
        .send({ error: { code: result.error.code, message: result.error.message } });
    }

    const projects = result.value;
    return reply.code(200).send({ projects: { items: projects, total: projects.length } });
  });
}
