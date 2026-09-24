import { z } from "zod";
import { defineListRoute, defineVoidRoute } from "../routing/defineTypedRoutes.js";
import { syncLogSchema } from "../responses/syncLogs.js";

export const listSyncLogsRoute = defineListRoute("syncLogs", {
  path: "/api/projects/:projectId/environments/:environmentId/sync-logs",
  description: "List sync log entries for a project",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  item: syncLogSchema,
});

export const deleteSyncLogRoute = defineVoidRoute({
  method: "DELETE",
  path: "/api/projects/:projectId/environments/:environmentId/sync-logs/:logId",
  description: "Delete a sync log entry",
  params: z.object({
    projectId: z.string(),
    environmentId: z.string(),
    logId: z.string(),
  }),
});
