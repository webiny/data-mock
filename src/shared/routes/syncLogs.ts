import { z } from "zod";
import { defineListRoute } from "../routing/defineTypedRoutes.js";
import { syncLogSchema } from "../responses/syncLogs.js";

export const listSyncLogsRoute = defineListRoute("syncLogs", {
  path: "/api/projects/:projectId/sync-logs",
  description: "List sync log entries for a project",
  params: z.object({ projectId: z.string() }),
  item: syncLogSchema,
});
