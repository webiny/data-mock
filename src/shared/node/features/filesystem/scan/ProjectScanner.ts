import fs from "node:fs";
import path from "node:path";
import { Result } from "@webiny/stdlib";
import { ListScanRootsRepository } from "~/shared/node/features/scanRoots/list/abstractions/ListScanRootsRepository.js";
import { ListProjectsRepository } from "~/shared/node/features/projects/list/abstractions/ListProjectsRepository.js";
import { WebinyProjectDetector } from "~/shared/node/features/webinyCli/detect/abstractions/WebinyProjectDetector.js";
import { ProjectScanner as Abstraction } from "./abstractions/ProjectScanner.js";
import { ValidationError } from "~/shared/errors.js";
import { SKIP_DIRECTORIES, hasWebinyMarker } from "../webinyMarkers.js";
import type { ProjectCandidate, ScanError, ScanResult } from "~/shared/types.js";

const DEFAULT_MAX_DEPTH = 3;

/**
 * Walks the scan roots and reports the Webiny checkouts under them.
 *
 * Descent stops at the first marker: a checkout's own `apps/` and `packages/` hold nothing that is
 * a separate project, and the framework monorepo carries dozens of `webiny.config.tsx` files below
 * its root that are fixtures and templates, not systems. The nearest ancestor with a marker is the
 * project; everything under it belongs to it.
 *
 * Already-registered checkouts are returned too, flagged `registered`, so the scan result is a
 * complete picture of the disk rather than a list that silently shrinks each time one is added.
 */
class ProjectScannerImpl implements Abstraction.Interface {
  public constructor(
    private readonly listScanRootsRepository: ListScanRootsRepository.Interface,
    private readonly listProjectsRepository: ListProjectsRepository.Interface,
    private readonly detector: WebinyProjectDetector.Interface,
  ) {}

  public async execute(input: Abstraction.Input): Promise<Result<ScanResult, Abstraction.Error>> {
    const rootsResult = await this.resolveRoots(input.paths);
    if (rootsResult.isFail()) {
      return Result.fail(rootsResult.error);
    }

    const maxDepth = input.maxDepth ?? DEFAULT_MAX_DEPTH;
    const errors: ScanError[] = [];
    const found = new Set<string>();

    for (const root of rootsResult.value) {
      this.walk(root, maxDepth, found, errors);
    }

    const registered = await this.registeredPaths();
    const candidates: ProjectCandidate[] = [];

    for (const rootPath of [...found].sort()) {
      const detected = await this.detector.execute({ rootPath });

      candidates.push({
        rootPath,
        name: path.basename(rootPath),
        versionMajor: detected.isOk() ? detected.value.versionMajor : null,
        webinyVersion: detected.isOk() ? detected.value.webinyVersion : null,
        registered: registered.has(rootPath),
      });
    }

    return Result.ok({ candidates, errors, rootsScanned: rootsResult.value.length });
  }

  private async resolveRoots(paths?: string[]): Promise<Result<string[], Abstraction.Error>> {
    if (paths !== undefined) {
      const resolved: string[] = [];
      for (const candidate of paths) {
        if (!path.isAbsolute(candidate)) {
          return Result.fail(new ValidationError(`"${candidate}" is not an absolute path`));
        }
        resolved.push(path.resolve(candidate));
      }
      return Result.ok(resolved);
    }

    const stored = await this.listScanRootsRepository.execute();
    if (stored.isFail()) {
      return Result.fail(stored.error);
    }

    return Result.ok(stored.value.map((root) => root.path));
  }

  private async registeredPaths(): Promise<Set<string>> {
    // Archived projects count as registered: re-adding one would collide with the row that is
    // still there, so the scan must not offer it as new.
    const projects = await this.listProjectsRepository.execute({ includeArchived: true });
    if (projects.isFail()) {
      return new Set();
    }

    const paths = new Set<string>();
    for (const project of projects.value) {
      if (project.rootPath !== null) {
        paths.add(path.resolve(project.rootPath));
      }
    }
    return paths;
  }

  private walk(directory: string, depth: number, found: Set<string>, errors: ScanError[]): void {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(directory);
    } catch (error) {
      errors.push({ path: directory, message: toMessage(error) });
      return;
    }

    if (!stat.isDirectory()) {
      errors.push({ path: directory, message: "Not a directory" });
      return;
    }

    if (hasWebinyMarker(directory)) {
      found.add(directory);
      return;
    }

    if (depth <= 0) {
      return;
    }

    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      errors.push({ path: directory, message: toMessage(error) });
      return;
    }

    for (const dirent of dirents) {
      if (!dirent.isDirectory()) {
        continue;
      }
      if (dirent.name.startsWith(".") || SKIP_DIRECTORIES.has(dirent.name)) {
        continue;
      }
      this.walk(path.join(directory, dirent.name), depth - 1, found, errors);
    }
  }
}

function toMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

export const ProjectScanner = Abstraction.createImplementation({
  implementation: ProjectScannerImpl,
  dependencies: [ListScanRootsRepository, ListProjectsRepository, WebinyProjectDetector],
});
