import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import "~/api/types.js";

const createProjectSchema = z.object({
  name: z.string().min(1),
  apiUrl: z.string().url(),
  apiToken: z.string().min(1),
  tenant: z.string().optional().default("root"),
});

export async function createProjectRoute(app: FastifyInstance): Promise<void> {
  app.post("/api/projects", async (request, reply) => {
    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "Validation/Error",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
      });
    }

    const repository = request.container.resolve(ProjectRepository);
    const result = await repository.create(parsed.data);

    if (result.isFail()) {
      return reply
        .code(500)
        .send({ error: { code: result.error.code, message: result.error.message } });
    }

    return reply.code(201).send({ project: result.value });
  });
}
