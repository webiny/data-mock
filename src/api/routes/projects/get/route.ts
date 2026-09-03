import type { FastifyInstance } from "fastify";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import "~/api/types.js";

export async function getProjectRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    const repository = request.container.resolve(ProjectRepository);
    const result = await repository.getById(request.params.id);

    if (result.isFail()) {
      const statusCode = result.error.code === "Project/NotFound" ? 404 : 500;
      return reply
        .code(statusCode)
        .send({ error: { code: result.error.code, message: result.error.message } });
    }

    return reply.code(200).send({ project: result.value });
  });
}
