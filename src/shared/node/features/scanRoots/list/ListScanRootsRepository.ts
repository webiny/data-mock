import { Result } from "@webiny/stdlib";
import { asc } from "drizzle-orm";
import { scanRoots } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListScanRootsRepository as Abstraction } from "./abstractions/ListScanRootsRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { toScanRoot, toScanRootError } from "../toScanRoot.js";
import type { ScanRoot } from "~/shared/types.js";

class ListScanRootsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(): Promise<Result<ScanRoot[], Abstraction.Error>> {
    try {
      const rows = this.databaseClient.db
        .select()
        .from(scanRoots)
        .orderBy(asc(scanRoots.path))
        .all();

      return Result.ok(rows.map(toScanRoot));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toScanRootError(error)));
    }
  }
}

export const ListScanRootsRepository = Abstraction.createImplementation({
  implementation: ListScanRootsRepositoryImpl,
  dependencies: [DatabaseClient],
});
