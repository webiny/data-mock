import { Result, Logger } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { KeyRotationService as Abstraction } from "./abstractions/KeyRotationService.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { projectEnvironments } from "~/shared/node/db/schema.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { decryptWithKey, encryptWithKey, toKeyBuffer } from "./aesGcm.js";

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
      let oldKeyBuffer: Buffer;
      let newKeyBuffer: Buffer;
      try {
        oldKeyBuffer = toKeyBuffer(oldKey);
      } catch {
        return Result.fail(
          new ProjectPersistenceError(new Error("Old key must be a 64-character hex string.")),
        );
      }
      try {
        newKeyBuffer = toKeyBuffer(newKey);
      } catch {
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
            const plaintext = decryptWithKey(environment.apiToken, oldKeyBuffer);
            const newCiphertext = encryptWithKey(plaintext, newKeyBuffer);

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
