import type { FastifyInstance } from "fastify";
import { registerProjectRoutes } from "./projects/index.js";
import { registerTenantRoutes } from "./tenants/index.js";
import { registerModelRoutes } from "./models/index.js";
import { registerSeedingRoutes } from "./seeding/index.js";
import { registerTemplateRoutes } from "./templates/index.js";
import { registerEntryRoutes } from "./entries/index.js";
import { registerFileRoutes } from "./files/index.js";
import { registerSyncLogRoutes } from "./syncLogs/index.js";
import { registerImportRoutes } from "./import/index.js";
import { registerCleanupRoutes } from "./cleanup/index.js";
import { registerJobRoutes } from "./jobs/index.js";

export async function registerApiRoutes(app: FastifyInstance): Promise<void> {
  await registerProjectRoutes(app);
  await registerTenantRoutes(app);
  await registerModelRoutes(app);
  await registerSeedingRoutes(app);
  await registerTemplateRoutes(app);
  await registerEntryRoutes(app);
  await registerFileRoutes(app);
  await registerSyncLogRoutes(app);
  await registerImportRoutes(app);
  await registerCleanupRoutes(app);
  await registerJobRoutes(app);
}
