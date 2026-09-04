import { z } from "zod";
import { defineListRoute, defineOneRoute, defineVoidRoute } from "../routing/defineTypedRoutes.js";
import { seedEntrySchema } from "../responses/entries.js";

export const listSeedEntriesRoute = defineListRoute("seedEntries", {
  path: "/api/projects/:projectId/entries",
  description: "List seeded entries for a project (paginated, filterable)",
  params: z.object({ projectId: z.string() }),
  item: seedEntrySchema,
});

export const getSeedEntryRoute = defineOneRoute("seedEntry", {
  path: "/api/projects/:projectId/entries/:entryId",
  description: "Get a single seeded entry by ID",
  params: z.object({ projectId: z.string(), entryId: z.string() }),
  item: seedEntrySchema,
});

export const deleteProjectEntriesRoute = defineVoidRoute({
  method: "DELETE",
  path: "/api/projects/:projectId/entries",
  description: "Clear all seed entry audit log for a project",
  params: z.object({ projectId: z.string() }),
});
