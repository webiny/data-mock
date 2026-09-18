import { z } from "zod";
import { defineListRoute, defineOneRoute, defineVoidRoute } from "../routing/defineTypedRoutes.js";
import {
  browseResultSchema,
  createScanRootBodySchema,
  scanBodySchema,
  scanResultSchema,
  scanRootSchema,
} from "../responses/filesystem.js";

/**
 * Lists the subdirectories of one directory, flagging the ones that are Webiny checkouts. Returns
 * directory names only — never files, never file contents. Reachable on 127.0.0.1 only (ADR 006).
 *
 * `?path=` is optional; without it the browser starts at the user's home directory.
 */
export const browseDirectoryRoute = defineOneRoute("browse", {
  path: "/api/fs/browse",
  description: "List the subdirectories of a path, flagging Webiny projects",
  params: z.object({}),
  item: browseResultSchema,
});

export const scanForProjectsRoute = defineOneRoute("scan", {
  method: "POST",
  path: "/api/fs/scan",
  description: "Scan the saved roots (or given paths) for Webiny projects",
  params: z.object({}),
  body: scanBodySchema,
  item: scanResultSchema,
});

export const listScanRootsRoute = defineListRoute("scanRoots", {
  path: "/api/scan-roots",
  description: "List the directories scanned for Webiny projects",
  params: z.object({}),
  item: scanRootSchema,
});

export const createScanRootRoute = defineOneRoute("scanRoot", {
  method: "POST",
  path: "/api/scan-roots",
  description: "Add a directory to scan for Webiny projects",
  params: z.object({}),
  body: createScanRootBodySchema,
  item: scanRootSchema,
});

/** Forgets a directory to look in. Projects already registered from it are untouched. */
export const removeScanRootRoute = defineVoidRoute({
  method: "DELETE",
  path: "/api/scan-roots/:id",
  description: "Remove a scan root",
  params: z.object({ id: z.string() }),
});
