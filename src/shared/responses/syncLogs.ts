import { z } from "zod";

export const syncLogSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  environmentId: z.string(),
  // Narrowed rather than left as strings: the gateway maps the response straight onto the
  // domain `SyncLog`, and a plain `z.string()` here is what forced a cast at that boundary.
  type: z.enum(["tenants", "models", "upload-file", "pull-files"]),
  status: z.enum(["success", "error"]),
  message: z.string(),
  request: z.unknown().nullable(),
  response: z.unknown().nullable(),
  createdAt: z.number(),
});

export type SyncLogResponse = z.infer<typeof syncLogSchema>;
