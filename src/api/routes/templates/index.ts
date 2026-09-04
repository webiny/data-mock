import type { FastifyInstance } from "fastify";
import { listSeedTemplates } from "./list/route.js";
import { createSeedTemplate } from "./create/route.js";
import { deleteSeedTemplate } from "./delete/route.js";

export async function registerTemplateRoutes(app: FastifyInstance): Promise<void> {
  await listSeedTemplates(app);
  await createSeedTemplate(app);
  await deleteSeedTemplate(app);
}
