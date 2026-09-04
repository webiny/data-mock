import type { FastifyInstance } from "fastify";
import { importEntries } from "./route.js";

export async function registerImportRoutes(app: FastifyInstance): Promise<void> {
  await importEntries(app);
}
