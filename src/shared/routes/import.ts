import { z } from "zod";
import { defineOneRoute } from "../routing/defineTypedRoutes.js";

export const importEntriesRoute = defineOneRoute("import", {
  method: "POST",
  path: "/api/projects/:projectId/import",
  description: "Import existing entries from Webiny for selected models",
  params: z.object({ projectId: z.string() }),
  body: z.object({
    tenant: z.string().min(1),
    models: z.array(z.string().min(1)),
  }),
  item: z.object({
    imported: z.number(),
    models: z.array(
      z.object({
        modelId: z.string(),
        count: z.number(),
      }),
    ),
  }),
});
