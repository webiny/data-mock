import { z } from "zod";

/**
 * One descriptor per job type — the single source the `JobType` union, the enqueue body schema,
 * the two label maps and the dataset-invalidation map are all derived from.
 *
 * Before this table those six lists were maintained by hand and had already drifted: `pull-picsum`
 * was missing from all four UI maps (so it never refreshed the UI and rendered a raw slug), and
 * `upload-files` was missing from the enqueue enum and the notification labels.
 */
export interface JobTypeDescriptor {
  /** Wire value stored in `jobs.type`. */
  readonly type: string;
  /** Human label — used in the jobs table, the type filter and completion notifications. */
  readonly label: string;
  /**
   * Which project-detail datasets to invalidate when a job of this type reaches a terminal status.
   */
  readonly datasets: readonly string[];
  /**
   * Whether `POST /api/projects/:projectId/jobs` accepts this type.
   *
   * This is NOT decoration. That route's body is a bare `config` record, so making every type
   * enqueueable would let `{"type":"destroy"}` run a destroy with an unvalidated config, routing
   * around both confirmation dialogs. Types that have their own dedicated route, or that must only
   * be started from a confirmed UI flow, stay `false`.
   */
  readonly enqueueable: boolean;
  /** What the job is scoped to. Drives which id columns the executor requires. */
  readonly scope: "global" | "project" | "environment";
  /** Validates `config` at the enqueue boundary. */
  readonly configSchema: z.ZodType;
}

const environmentConfig = z.object({ environmentId: z.string().min(1) });

/** Which projects a sync preview covers. One for a single project, many for "sync all". */
export const syncPreviewJobConfigSchema = z.object({
  projectIds: z.array(z.string().min(1)).min(1),
});

/** Deploy and destroy: which environment, and which of its apps. */
const deploymentConfig = z.object({
  environmentId: z.string().min(1),
  apps: z.array(z.string().min(1)).optional(),
  region: z.string().min(1).optional(),
  preview: z.boolean().optional(),
});

export const JOB_TYPE_DESCRIPTORS = [
  {
    type: "seed",
    label: "Seed data",
    datasets: ["entries", "seedJobs", "jobs"],
    enqueueable: true,
    scope: "environment",
    configSchema: environmentConfig.loose(),
  },
  {
    type: "pull-tenants",
    label: "Pull tenants",
    datasets: ["tenants", "syncLogs", "jobs"],
    enqueueable: true,
    scope: "environment",
    configSchema: environmentConfig,
  },
  {
    type: "pull-models",
    label: "Pull models",
    datasets: ["models", "syncLogs", "jobs"],
    enqueueable: true,
    scope: "environment",
    configSchema: environmentConfig,
  },
  {
    type: "cleanup",
    label: "Cleanup entries",
    datasets: ["entries", "jobs"],
    enqueueable: true,
    scope: "environment",
    configSchema: environmentConfig.loose(),
  },
  {
    type: "import",
    label: "Import entries",
    datasets: ["entries", "jobs"],
    enqueueable: true,
    scope: "environment",
    configSchema: environmentConfig.loose(),
  },
  {
    type: "upload-files",
    label: "Upload files",
    datasets: ["files", "syncLogs", "jobs"],
    // Has its own upload route; the generic enqueue endpoint never accepted it.
    enqueueable: false,
    scope: "environment",
    configSchema: environmentConfig.loose(),
  },
  {
    type: "pull-picsum",
    label: "Pull placeholder images",
    datasets: ["jobs"],
    // Started through POST /api/files/picsum/pull, which is not project-scoped.
    enqueueable: false,
    scope: "global",
    configSchema: z
      .object({
        count: z.number().int().min(1).max(500).optional(),
        width: z.number().int().min(1).optional(),
        height: z.number().int().min(1).optional(),
      })
      .loose(),
  },
  {
    type: "sync-system",
    label: "Sync system info",
    // A sync rewrites the environment list itself, not just the stacks hanging off it.
    datasets: ["environments", "stacks", "jobs"],
    enqueueable: true,
    scope: "project",
    configSchema: z.object({}).loose(),
  },
  {
    type: "sync-preview",
    label: "Preview sync",
    // Writes nothing, so nothing to invalidate. The dialog reads the result off the job row.
    datasets: [],
    /**
     * Started only through POST /api/sync/preview, which takes the project list in its body. The
     * generic route is project-scoped and could not express a preview of several projects.
     */
    enqueueable: false,
    /**
     * Global on purpose, although it reads project state. A preview writes nothing, so there is
     * nothing for the per-project serialization to protect — and scoping it to a project would
     * make the dialog sit behind a twenty-minute deploy before it could show a diff. Applying is
     * what re-reads under the lock.
     */
    scope: "global",
    configSchema: syncPreviewJobConfigSchema,
  },
  {
    type: "deploy",
    label: "Deploy",
    datasets: ["environments", "stacks", "jobs"],
    /**
     * Not enqueueable through the generic route. Its body is a bare `config` record, so allowing
     * it would let a plain POST deploy an environment with no confirmation at all. Deploy is
     * started only through its own route, behind the confirmation dialog.
     */
    enqueueable: false,
    scope: "environment",
    configSchema: deploymentConfig,
  },
  {
    type: "destroy",
    label: "Destroy",
    datasets: ["environments", "stacks", "jobs"],
    /** Same reasoning as deploy, and more so: destroy is behind a typed-name confirmation. */
    enqueueable: false,
    scope: "environment",
    configSchema: deploymentConfig,
  },
] as const satisfies readonly JobTypeDescriptor[];

export type JobType = (typeof JOB_TYPE_DESCRIPTORS)[number]["type"];

const byType = new Map<string, JobTypeDescriptor>(
  JOB_TYPE_DESCRIPTORS.map((descriptor) => [descriptor.type, descriptor]),
);

export function getJobTypeDescriptor(type: string): JobTypeDescriptor | undefined {
  return byType.get(type);
}

/** Falls back to the raw wire value so an unknown type degrades to a slug, never to blank. */
export function getJobTypeLabel(type: string): string {
  return byType.get(type)?.label ?? type;
}

export function getJobTypeDatasets(type: string): readonly string[] {
  return byType.get(type)?.datasets ?? [];
}

export const ENQUEUEABLE_JOB_TYPES = JOB_TYPE_DESCRIPTORS.filter(
  (descriptor) => descriptor.enqueueable,
).map((descriptor) => descriptor.type);

/** Options for the jobs-table type filter, in declaration order. */
export const JOB_TYPE_OPTIONS = JOB_TYPE_DESCRIPTORS.map((descriptor) => ({
  value: descriptor.type,
  label: descriptor.label,
}));
