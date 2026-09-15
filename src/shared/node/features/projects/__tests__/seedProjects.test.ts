import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { seedProjectsFromFile } from "~/shared/node/seedProjects.js";
import { EncryptionService } from "~/shared/node/encryption/abstractions/EncryptionService.js";
import { projects } from "~/shared/node/db/schema.js";

describe("seedProjectsFromFile", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let dir: string;

  beforeEach(() => {
    tc = createTestContainer();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "seed-projects-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    tc.cleanup();
  });

  function seed(entries: unknown[]): void {
    const file = path.join(dir, "projects.json");
    fs.writeFileSync(file, JSON.stringify(entries));
    seedProjectsFromFile(tc.databaseClient, tc.container.resolve(EncryptionService), file);
  }

  function stored(name: string) {
    return tc.databaseClient.db.select().from(projects).where(eq(projects.name, name)).get();
  }

  const base = {
    name: "webiny-js-6.5",
    apiUrl: "https://api.example.com",
    apiToken: "token",
    tenant: "root",
  };

  it("registers the checkout a seeded project names", () => {
    seed([{ ...base, rootPath: "/work/webiny-js-6.5" }]);

    // Without a rootPath the project is remote-only, and Deploy, Destroy and Sync are all refused.
    expect(stored("webiny-js-6.5")?.rootPath).toBe("/work/webiny-js-6.5");
  });

  it("leaves a project remote-only when the file names no checkout", () => {
    seed([base]);

    expect(stored("webiny-js-6.5")?.rootPath).toBeNull();
  });

  it("never clears a checkout that the file does not mention", () => {
    seed([{ ...base, rootPath: "/work/webiny-js-6.5" }]);
    seed([base]);

    // A checkout registered through the UI must survive a re-seed of the same project.
    expect(stored("webiny-js-6.5")?.rootPath).toBe("/work/webiny-js-6.5");
  });

  it("normalises a name that is really a path, and does not duplicate the row", () => {
    seed([{ ...base, name: "Users/brunozoric/work/webiny/webiny-js-6.5" }]);
    seed([{ ...base, name: "Users/brunozoric/work/webiny/webiny-js-6.5" }]);

    const rows = tc.databaseClient.db.select().from(projects).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("webiny-js-6.5");
  });
});
