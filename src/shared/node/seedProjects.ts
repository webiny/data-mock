import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { projects, projectEnvironments, projectTenants } from "./db/schema.js";
import { and } from "drizzle-orm";
import type { DatabaseClient } from "./db/abstractions/DatabaseClient.js";
import type { EncryptionService } from "./encryption/abstractions/EncryptionService.js";
import { toProjectName } from "~/shared/projects/projectName.js";
import { checkProjectIsUnique } from "./features/projects/projectUniqueness.js";

const SEED_FILE_PATH = ".projects.json";

/**
 * `apiUrl` is a BASE url — operations append their own path (every operation declares
 * path: "/cms/manage"). Store the Pulumi `api.apiUrl` value, not a CMS endpoint.
 */
const projectSchema = z
  .object({
    name: z.string(),
    /**
     * Absolute path to the checkout, when there is one. Without it the project is remote-only: it
     * can be seeded, but it cannot be deployed, destroyed or synced from disk, and the Deploy and
     * Destroy buttons are not shown for it.
     */
    rootPath: z.string().min(1).optional(),
    apiUrl: z.string(),
    apiToken: z.string(),
    tenant: z.string().default("root"),
    env: z.string().default("dev"),
    operationsVersion: z.string().optional(),
    /**
     * Former name for operationsVersion. Kept as an alias so existing .projects.json files keep
     * working — without it the key is ignored and the version silently falls back to the default,
     * quietly selecting a different GraphQL operation set.
     */
    webinyVersion: z.string().optional(),
  })
  .transform((project) => ({
    ...project,
    operationsVersion: project.operationsVersion ?? project.webinyVersion ?? "6.0.0",
  }));

const seedFileSchema = z.array(projectSchema);

export function seedProjectsFromFile(
  databaseClient: DatabaseClient.Interface,
  encryptionService: EncryptionService.Interface,
  /** Overridable so a test can seed from its own file instead of the working directory's. */
  seedFilePath: string = SEED_FILE_PATH,
): void {
  const filePath = path.resolve(seedFilePath);
  if (!fs.existsSync(filePath)) {
    return;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    console.warn(`Failed to parse ${seedFilePath}, skipping project seeding.`);
    return;
  }

  const parsed = seedFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(`Invalid ${seedFilePath}: ${parsed.error.issues[0]?.message ?? "unknown"}`);
    return;
  }

  const { db } = databaseClient;
  const now = Date.now();

  for (const project of parsed.data) {
    /**
     * Matched on the RAW name, because that is what is already stored — older entries in
     * `.projects.json` carry a whole path as their name. Only what gets written is normalised, so
     * re-seeding renames those rows instead of inserting a duplicate beside them.
     */
    const name = toProjectName(project.name);
    const existing =
      db.select().from(projects).where(eq(projects.name, project.name)).get() ??
      db.select().from(projects).where(eq(projects.name, name)).get();

    /**
     * A checkout already claimed by another project is left alone. Two projects pointing at one
     * folder means two inventories of the same stacks, each overwriting the other on sync.
     */
    const clash =
      project.rootPath === undefined
        ? null
        : checkProjectIsUnique(databaseClient, {
            rootPath: project.rootPath,
            ...(existing ? { excludeId: existing.id } : {}),
          });

    if (clash !== null) {
      console.warn(`Skipping "${name}" from ${seedFilePath}: ${clash.message}`);
      continue;
    }

    const encryptedToken = encryptionService.encrypt(project.apiToken);

    let projectId: string;

    if (existing) {
      projectId = existing.id;
      db.update(projects)
        .set({
          name,
          operationsVersion: project.operationsVersion,
          // Only ever set from the file, never cleared by it: a checkout registered through the UI
          // must survive a re-seed of the same project.
          ...(project.rootPath !== undefined ? { rootPath: project.rootPath } : {}),
          updatedAt: now,
        })
        .where(eq(projects.id, existing.id))
        .run();
    } else {
      projectId = generateId();
      db.insert(projects)
        .values({
          id: projectId,
          name,
          rootPath: project.rootPath ?? null,
          operationsVersion: project.operationsVersion,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    // Connection details belong to an environment, so seeded projects get one.
    const existingEnvironment = db
      .select()
      .from(projectEnvironments)
      .where(
        and(
          eq(projectEnvironments.projectId, projectId),
          eq(projectEnvironments.env, project.env),
          eq(projectEnvironments.variant, ""),
        ),
      )
      .get();

    let environmentId: string;

    if (existingEnvironment) {
      environmentId = existingEnvironment.id;
      db.update(projectEnvironments)
        .set({
          apiUrl: project.apiUrl,
          apiToken: encryptedToken,
          tenant: project.tenant,
          deployed: 1,
          updatedAt: now,
        })
        .where(eq(projectEnvironments.id, environmentId))
        .run();
    } else {
      environmentId = generateId();
      db.insert(projectEnvironments)
        .values({
          id: environmentId,
          projectId,
          env: project.env,
          variant: "",
          region: null,
          deployed: 1,
          apiUrl: project.apiUrl,
          apiToken: encryptedToken,
          adminUrl: null,
          tenant: project.tenant,
          lastSyncedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    const hasRootTenant = db
      .select()
      .from(projectTenants)
      .where(
        and(
          eq(projectTenants.environmentId, environmentId),
          eq(projectTenants.tenantId, project.tenant),
        ),
      )
      .get();

    if (!hasRootTenant) {
      db.insert(projectTenants)
        .values({
          id: generateId(),
          projectId,
          environmentId,
          tenantId: project.tenant,
          name: project.tenant,
          discoveredAt: now,
        })
        .run();
    }
  }

  console.log(`Seeded ${parsed.data.length} project(s) from ${seedFilePath}.`);
}
