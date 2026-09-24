import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { scanRoots } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { RemoveScanRootRepository as Abstraction } from "./abstractions/RemoveScanRootRepository.js";
import { ProjectPersistenceError, ScanRootNotFoundError } from "~/shared/errors.js";
import { toScanRootError } from "../toScanRoot.js";

/** Removing a scan root forgets a directory to look in. It never touches what was found there. */
class RemoveScanRootRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<void, Abstraction.Error>> {
    try {
      const existing = this.databaseClient.db
        .select({ id: scanRoots.id })
        .from(scanRoots)
        .where(eq(scanRoots.id, input.id))
        .get();

      if (!existing) {
        return Result.fail(new ScanRootNotFoundError(input.id));
      }

      this.databaseClient.db.delete(scanRoots).where(eq(scanRoots.id, input.id)).run();

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toScanRootError(error)));
    }
  }
}

export const RemoveScanRootRepository = Abstraction.createImplementation({
  implementation: RemoveScanRootRepositoryImpl,
  dependencies: [DatabaseClient],
});
