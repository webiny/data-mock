import fs from "node:fs";
import path from "node:path";

/**
 * The root markers, shared by the directory browser and the scanner so both agree with
 * `WebinyProjectDetector` on what counts as a project root.
 *
 * This is a cheap existence check on purpose: browsing a directory with hundreds of children must
 * not run full version detection on each one.
 */
const MARKERS = ["webiny.config.tsx", "webiny.project.ts", "webiny.project.js", "webiny.root.js"];

export function hasWebinyMarker(directory: string): boolean {
  return MARKERS.some((marker) => fs.existsSync(path.join(directory, marker)));
}

/**
 * Directories a scan never descends into. `node_modules` alone would otherwise dominate the walk,
 * and every Webiny checkout has one holding hundreds of packages — several of which carry a
 * `webiny.config.tsx` of their own and would be reported as projects.
 */
export const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".yarn",
  ".pulumi",
  ".webiny",
  "dist",
  "build",
  ".next",
  ".cache",
  "coverage",
]);
