import { z } from "zod";

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiUrl: z.string(),
  apiToken: z.string(),
  tenant: z.string(),
  webinyVersion: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ProjectResponse = z.infer<typeof projectSchema>;

export const createProjectBodySchema = z.object({
  name: z.string().min(1),
  apiUrl: z.string().url(),
  apiToken: z.string().min(1),
  tenant: z.string().optional().default("root"),
  webinyVersion: z.string().optional().default("6.0.0"),
});

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;

export const updateProjectBodySchema = z
  .object({
    name: z.string().min(1),
    apiUrl: z.string().url(),
    apiToken: z.string().min(1),
    tenant: z.string().min(1),
    webinyVersion: z.string().min(1),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;
