import { z } from "zod";
import { defineOneRoute } from "../routing/defineTypedRoutes.js";
import { jobSchema } from "./jobs.js";

export const importEntriesRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/projects/:projectId/import",
  description: "Import existing entries from Webiny for selected models",
  params: z.object({ projectId: z.string() }),
  body: z.object({
    tenant: z.string().min(1),
    models: z.array(z.string().min(1)),
  }),
  item: jobSchema,
});
