import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { Result, Logger } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { KeyRotationService as Abstraction } from "./abstractions/KeyRotationService.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { projects } from "~/shared/node/db/schema.js";
import { ProjectPersistenceError } from "~/shared/errors.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SEPARATOR = ":";

function decryptWithKey(ciphertext: string, keyHex: string): string {
  const keyBuffer = Buffer.from(keyHex, "hex");
  const parts = ciphertext.split(SEPARATOR);
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format.");
  }

  const iv = Buffer.from(parts[0]!, "base64");
  const authTag = Buffer.from(parts[1]!, "base64");
  const encrypted = Buffer.from(parts[2]!, "base64");

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function encryptWithKey(plaintext: string, keyHex: string): string {
  const keyBuffer = Buffer.from(keyHex, "hex");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(
    SEPARATOR,
  );
}

class KeyRotationServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const { oldKey, newKey } = input;

    try {
      const oldKeyBuffer = Buffer.from(oldKey, "hex");
      const newKeyBuffer = Buffer.from(newKey, "hex");

      if (oldKeyBuffer.length !== 32) {
        return Result.fail(
          new ProjectPersistenceError(new Error("Old key must be a 64-character hex string.")),
        );
      }
      if (newKeyBuffer.length !== 32) {
        return Result.fail(
          new ProjectPersistenceError(new Error("New key must be a 64-character hex string.")),
        );
      }

      const allProjects = this.databaseClient.db
        .select({ id: projects.id, apiToken: projects.apiToken })
        .from(projects)
        .all();

      let rotated = 0;

      for (const project of allProjects) {
        try {
          const plaintext = decryptWithKey(project.apiToken, oldKey);
          const newCiphertext = encryptWithKey(plaintext, newKey);

          this.databaseClient.db
            .update(projects)
            .set({ apiToken: newCiphertext, updatedAt: Date.now() })
            .where(eq(projects.id, project.id))
            .run();

          rotated++;
        } catch (err) {
          this.logger.error(
            `Failed to rotate key for project "${project.id}": ${err instanceof Error ? err.message : String(err)}`,
          );
          return Result.fail(
            new ProjectPersistenceError(
              new Error(
                `Key rotation failed at project "${project.id}". Some tokens may be in an inconsistent state.`,
              ),
            ),
          );
        }
      }

      this.logger.info(`Rotated encryption key for ${rotated} project(s).`);
      return Result.ok({ rotated });
    } catch (err) {
      return Result.fail(
        new ProjectPersistenceError(err instanceof Error ? err : new Error(String(err))),
      );
    }
  }
}

export const KeyRotationService = Abstraction.createImplementation({
  implementation: KeyRotationServiceImpl,
  dependencies: [DatabaseClient, Logger],
});
