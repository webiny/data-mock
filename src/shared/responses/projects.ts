import { z } from "zod";

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiUrl: z.string(),
  apiToken: z.string(),
  tenant: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ProjectResponse = z.infer<typeof projectSchema>;

export const createProjectBodySchema = z.object({
  name: z.string().min(1),
  apiUrl: z.string().url(),
  apiToken: z.string().min(1),
  tenant: z.string().optional().default("root"),
});

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
