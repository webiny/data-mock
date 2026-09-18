import { scanRoots } from "~/shared/node/db/schema.js";
import type { ScanRoot } from "~/shared/types.js";

type ScanRootRow = typeof scanRoots.$inferSelect;

export function toScanRoot(row: ScanRootRow): ScanRoot {
  return {
    id: row.id,
    path: row.path,
    createdAt: row.createdAt,
  };
}

export function toScanRootError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
