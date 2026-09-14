import fs from "node:fs";
import path from "node:path";
import { Result, generateId } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { scanRoots } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { CreateScanRootRepository as Abstraction } from "./abstractions/CreateScanRootRepository.js";
import { ProjectPersistenceError, ValidationError } from "~/shared/errors.js";
import { toScanRoot, toScanRootError } from "../toScanRoot.js";
import type { ScanRoot } from "~/shared/types.js";

/**
 * Paths are resolved before they are stored, so `~/work` and `~/work/` cannot both be added as
 * separate roots and scan the same tree twice. Adding a root that already exists returns the
 * existing row rather than failing — the user asked for that path to be scanned, and it is.
 */
class CreateScanRootRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<ScanRoot, Abstraction.Error>> {
    const resolved = path.resolve(input.path);

    if (!path.isAbsolute(resolved)) {
      return Result.fail(new ValidationError(`"${input.path}" is not an absolute path`));
    }

    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return Result.fail(new ValidationError(`"${resolved}" is not a directory`));
    }

    try {
      const existing = this.databaseClient.db
        .select()
        .from(scanRoots)
        .where(eq(scanRoots.path, resolved))
        .get();

      if (existing) {
        return Result.ok(toScanRoot(existing));
      }

      const row = { id: generateId(), path: resolved, createdAt: Date.now() };
      this.databaseClient.db.insert(scanRoots).values(row).run();

      return Result.ok(toScanRoot(row));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toScanRootError(error)));
    }
  }
}

export const CreateScanRootRepository = Abstraction.createImplementation({
  implementation: CreateScanRootRepositoryImpl,
  dependencies: [DatabaseClient],
});
