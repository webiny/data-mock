import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { projects } from "./db/schema.js";
import type { DatabaseClient } from "./db/abstractions/DatabaseClient.js";
import type { EncryptionService } from "./encryption/abstractions/EncryptionService.js";

const SEED_FILE_PATH = ".projects.json";

const projectSchema = z.object({
  name: z.string(),
  apiUrl: z.string(),
  apiToken: z.string(),
  tenant: z.string().default("root"),
  webinyVersion: z.string().default("6.0.0"),
});

const seedFileSchema = z.array(projectSchema);

export function seedProjectsFromFile(
  databaseClient: DatabaseClient.Interface,
  encryptionService: EncryptionService.Interface,
): void {
  const filePath = path.resolve(SEED_FILE_PATH);
  if (!fs.existsSync(filePath)) {
    return;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    console.warn(`Failed to parse ${SEED_FILE_PATH}, skipping project seeding.`);
    return;
  }

  const parsed = seedFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(`Invalid ${SEED_FILE_PATH}: ${parsed.error.issues[0]?.message ?? "unknown"}`);
    return;
  }

  const { db } = databaseClient;
  const now = Date.now();

  for (const project of parsed.data) {
    const existing = db.select().from(projects).where(eq(projects.name, project.name)).get();

    const encryptedToken = encryptionService.encrypt(project.apiToken);

    if (existing) {
      db.update(projects)
        .set({
          apiUrl: project.apiUrl,
          apiToken: encryptedToken,
          tenant: project.tenant,
          webinyVersion: project.webinyVersion,
          updatedAt: now,
        })
        .where(eq(projects.id, existing.id))
        .run();
    } else {
      db.insert(projects)
        .values({
          id: generateId(),
          name: project.name,
          apiUrl: project.apiUrl,
          apiToken: encryptedToken,
          tenant: project.tenant,
          webinyVersion: project.webinyVersion,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }

  console.log(`Seeded ${parsed.data.length} project(s) from ${SEED_FILE_PATH}.`);
}
