import { z } from "zod";

/**
 * The config both deployment executors read off the job.
 *
 * `apps` is optional and an empty list means "every deployable app for this version" — the tool
 * expands it, because the deployable set is a per-version fact the caller should not have to know.
 */
export const deploymentJobConfigSchema = z.object({
  environmentId: z.string().min(1),
  apps: z.array(z.string().min(1)).optional(),
  region: z.string().min(1).optional(),
  /** Deploy only: plan the change and create nothing. */
  preview: z.boolean().optional(),
});

export type DeploymentJobConfig = z.infer<typeof deploymentJobConfigSchema>;

export function parseDeploymentJobConfig(configJson: string | null): DeploymentJobConfig {
  if (configJson === null) {
    throw new Error("Deployment jobs require a config naming the environment");
  }

  const parsed = deploymentJobConfigSchema.safeParse(JSON.parse(configJson));

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid deployment job config");
  }

  return parsed.data;
}
