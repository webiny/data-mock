import type { FastifyInstance } from "fastify";
import { listSeedEntries } from "./list/route.js";
import { getSeedEntry } from "./get/route.js";
import { deleteProjectEntries } from "./delete/route.js";

export async function registerEntryRoutes(app: FastifyInstance): Promise<void> {
  await listSeedEntries(app);
  await getSeedEntry(app);
  await deleteProjectEntries(app);
}
