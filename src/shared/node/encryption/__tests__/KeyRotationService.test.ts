import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { createDatabaseClient } from "~/shared/node/db/client.js";
import { runMigrations } from "~/shared/node/db/migrate.js";
import { DatabaseFeature } from "~/shared/node/db/feature.js";
import { PinoLoggerFeature } from "@webiny/stdlib/node";
import { projectEnvironments, projects } from "~/shared/node/db/schema.js";
import { EncryptionKey } from "../abstractions/EncryptionKey.js";
import { EncryptionService as EncryptionServiceAbstraction } from "../abstractions/EncryptionService.js";
import { EncryptionService } from "../EncryptionService.js";
import { KeyRotationService as Abstraction } from "../abstractions/KeyRotationService.js";
import { KeyRotationService } from "../KeyRotationService.js";
import type { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";

const OLD_KEY = randomBytes(32).toString("hex");
const NEW_KEY = randomBytes(32).toString("hex");

describe("KeyRotationService", () => {
  let container: Container;
  let databaseClient: DatabaseClient.Interface;

  beforeEach(() => {
    container = new Container();
    PinoLoggerFeature.register(container);

    databaseClient = createDatabaseClient(":memory:");
    runMigrations(databaseClient.db);
    DatabaseFeature.register(container, { databaseClient });

    container.registerInstance(EncryptionKey, { key: OLD_KEY });
    container.register(EncryptionService).inSingletonScope();
    container.register(KeyRotationService).inSingletonScope();

    databaseClient.db
      .insert(projects)
      .values({
        id: "project-1",
        name: "Blog",
        rootPath: null,
        webinyVersion: null,
        versionSource: null,
        versionMajor: null,
        operationsVersion: "6.0.0",
        pulumiBackend: null,
        awsProfile: null,
        awsRegion: null,
        lastSyncedAt: null,
        lastSyncStatus: null,
        archivedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .run();
  });

  afterEach(() => {
    container.registerInstance(EncryptionKey, { key: OLD_KEY });
  });

  /** Encrypts with whichever key is given, through the service that stores tokens for real. */
  function encryptWith(key: string, plaintext: string): string {
    const scoped = new Container();
    scoped.registerInstance(EncryptionKey, { key });
    scoped.register(EncryptionService).inSingletonScope();
    return scoped.resolve(EncryptionServiceAbstraction).encrypt(plaintext);
  }

  function decryptWith(key: string, ciphertext: string): string {
    const scoped = new Container();
    scoped.registerInstance(EncryptionKey, { key });
    scoped.register(EncryptionService).inSingletonScope();
    return scoped.resolve(EncryptionServiceAbstraction).decrypt(ciphertext);
  }

  function addEnvironment(id: string, env: string, apiToken: string | null): void {
    databaseClient.db
      .insert(projectEnvironments)
      .values({
        id,
        projectId: "project-1",
        env,
        variant: "",
        region: null,
        deployed: 0,
        apiUrl: null,
        adminUrl: null,
        apiToken,
        tenant: "root",
        lastSyncedAt: null,
        archivedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .run();
  }

  function storedToken(id: string): string | null {
    return (
      databaseClient.db
        .select({ apiToken: projectEnvironments.apiToken })
        .from(projectEnvironments)
        .where(eq(projectEnvironments.id, id))
        .get()?.apiToken ?? null
    );
  }

  function service(): Abstraction.Interface {
    return container.resolve(Abstraction);
  }

  it("re-encrypts every stored token so it reads back under the new key", async () => {
    addEnvironment("env-1", "dev", encryptWith(OLD_KEY, "token-dev"));
    addEnvironment("env-2", "prod", encryptWith(OLD_KEY, "token-prod"));

    const result = await service().execute({ oldKey: OLD_KEY, newKey: NEW_KEY });

    expect(result.isOk()).toBe(true);
    expect(result.isOk() && result.value.rotated).toBe(2);
    expect(decryptWith(NEW_KEY, storedToken("env-1")!)).toBe("token-dev");
    expect(decryptWith(NEW_KEY, storedToken("env-2")!)).toBe("token-prod");
  });

  it("leaves the old key unable to read what it rotated", async () => {
    addEnvironment("env-1", "dev", encryptWith(OLD_KEY, "token-dev"));

    await service().execute({ oldKey: OLD_KEY, newKey: NEW_KEY });

    // The point of a rotation: the previous key stops working.
    expect(() => decryptWith(OLD_KEY, storedToken("env-1")!)).toThrow();
  });

  it("stores a fresh ciphertext rather than the same bytes", async () => {
    const before = encryptWith(OLD_KEY, "token-dev");
    addEnvironment("env-1", "dev", before);

    await service().execute({ oldKey: OLD_KEY, newKey: NEW_KEY });

    expect(storedToken("env-1")).not.toBe(before);
  });

  it("skips an environment that has no token", async () => {
    addEnvironment("env-1", "dev", encryptWith(OLD_KEY, "token-dev"));
    addEnvironment("env-2", "prod", null);

    const result = await service().execute({ oldKey: OLD_KEY, newKey: NEW_KEY });

    // A discovered-but-not-connected environment has nothing to rotate.
    expect(result.isOk() && result.value.rotated).toBe(1);
    expect(storedToken("env-2")).toBeNull();
  });

  it("rotates nothing, and says so, when there are no tokens at all", async () => {
    addEnvironment("env-1", "dev", null);

    const result = await service().execute({ oldKey: OLD_KEY, newKey: NEW_KEY });

    expect(result.isOk() && result.value.rotated).toBe(0);
  });

  it("refuses an old key that is not 32 bytes", async () => {
    addEnvironment("env-1", "dev", encryptWith(OLD_KEY, "token-dev"));

    const result = await service().execute({ oldKey: "abcd", newKey: NEW_KEY });

    expect(result.isFail() && result.error.message).toContain("Old key must be");
  });

  it("refuses a new key that is not 32 bytes", async () => {
    addEnvironment("env-1", "dev", encryptWith(OLD_KEY, "token-dev"));

    const result = await service().execute({ oldKey: OLD_KEY, newKey: "abcd" });

    expect(result.isFail() && result.error.message).toContain("New key must be");
  });

  it("writes nothing when a key is refused", async () => {
    const before = encryptWith(OLD_KEY, "token-dev");
    addEnvironment("env-1", "dev", before);

    await service().execute({ oldKey: OLD_KEY, newKey: "abcd" });

    expect(storedToken("env-1")).toBe(before);
  });

  it("fails when a stored token cannot be read with the old key", async () => {
    addEnvironment("env-1", "dev", encryptWith(randomBytes(32).toString("hex"), "token-dev"));

    const result = await service().execute({ oldKey: OLD_KEY, newKey: NEW_KEY });

    expect(result.isFail()).toBe(true);
  });

  it("fails on a stored value that is not in the expected format", async () => {
    addEnvironment("env-1", "dev", "not-an-encrypted-value");

    const result = await service().execute({ oldKey: OLD_KEY, newKey: NEW_KEY });

    expect(result.isFail()).toBe(true);
  });

  it("leaves every token on the old key when one of them cannot be rotated", async () => {
    const good = encryptWith(OLD_KEY, "token-dev");
    const foreign = encryptWith(randomBytes(32).toString("hex"), "token-prod");
    // Ids order the select, so env-1 rotates before env-2 fails.
    addEnvironment("env-1", "dev", good);
    addEnvironment("env-2", "prod", foreign);

    const result = await service().execute({ oldKey: OLD_KEY, newKey: NEW_KEY });

    expect(result.isFail()).toBe(true);

    /**
     * The half-rotated state is the dangerous one. `rotate-key` does not rewrite `.env` when the
     * rotation fails, so ENCRYPTION_KEY still names the old key — and any token already written
     * under the new one would be unreadable for good.
     */
    expect(storedToken("env-1")).toBe(good);
    expect(decryptWith(OLD_KEY, storedToken("env-1")!)).toBe("token-dev");
    expect(storedToken("env-2")).toBe(foreign);
  });
});
