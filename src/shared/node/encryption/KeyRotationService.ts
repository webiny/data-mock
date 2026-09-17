import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { Result, Logger } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { KeyRotationService as Abstraction } from "./abstractions/KeyRotationService.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { projectEnvironments } from "~/shared/node/db/schema.js";
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

      /**
       * Tokens live on environments now, not projects. Rows with no token (an environment that is
       * discovered but not yet connected) have nothing to rotate.
       */
      const allEnvironments = this.databaseClient.db
        .select({ id: projectEnvironments.id, apiToken: projectEnvironments.apiToken })
        .from(projectEnvironments)
        .all();

      /**
       * All of them or none of them.
       *
       * Rotating row by row and stopping at the first failure left the database holding two keys
       * at once. `rotate-key` does not rewrite `.env` when the rotation fails, so `ENCRYPTION_KEY`
       * still named the old key — and every token already written under the new one was
       * unreadable for good. There is no recovery from that: the plaintext only ever existed
       * inside this loop.
       */
      const rotated = this.databaseClient.db.transaction((tx) => {
        let count = 0;

        for (const environment of allEnvironments) {
          if (environment.apiToken === null) {
            continue;
          }

          try {
            const plaintext = decryptWithKey(environment.apiToken, oldKey);
            const newCiphertext = encryptWithKey(plaintext, newKey);

            tx.update(projectEnvironments)
              .set({ apiToken: newCiphertext, updatedAt: Date.now() })
              .where(eq(projectEnvironments.id, environment.id))
              .run();

            count++;
          } catch (error) {
            this.logger.error(
              `Failed to rotate key for environment "${environment.id}": ${error instanceof Error ? error.message : String(error)}`,
            );
            // Thrown, not returned: the throw is what rolls the transaction back.
            throw new Error(
              `Key rotation failed at environment "${environment.id}". Nothing was changed.`,
            );
          }
        }

        return count;
      });

      this.logger.info(`Rotated the encryption key for ${rotated} environment(s).`);
      return Result.ok({ rotated });
    } catch (error) {
      return Result.fail(
        new ProjectPersistenceError(error instanceof Error ? error : new Error(String(error))),
      );
    }
  }
}

export const KeyRotationService = Abstraction.createImplementation({
  implementation: KeyRotationServiceImpl,
  dependencies: [DatabaseClient, Logger],
});
