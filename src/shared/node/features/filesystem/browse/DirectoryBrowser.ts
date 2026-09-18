import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Result } from "@webiny/stdlib";
import { DirectoryBrowser as Abstraction } from "./abstractions/DirectoryBrowser.js";
import { ValidationError } from "~/shared/errors.js";
import { hasWebinyMarker } from "../webinyMarkers.js";
import type { BrowseResult, DirectoryEntry } from "~/shared/types.js";

/**
 * Lists the subdirectories of one directory so a project can be picked without typing a path.
 *
 * It returns directory names only — never file contents, and never files. The path is resolved
 * through `realpathSync` first, so a symlink is followed once, to its target, and what comes back
 * is the real location the user is actually browsing rather than the link that pointed at it.
 *
 * The API server binds to 127.0.0.1 (ADR 006), which is what keeps this from being a filesystem
 * read primitive exposed to the network.
 */
class DirectoryBrowserImpl implements Abstraction.Interface {
  public async execute(input: Abstraction.Input): Promise<Result<BrowseResult, ValidationError>> {
    const requested = input.path === undefined || input.path === "" ? os.homedir() : input.path;

    if (!path.isAbsolute(requested)) {
      return Result.fail(new ValidationError(`"${requested}" is not an absolute path`));
    }

    let resolved: string;
    try {
      resolved = fs.realpathSync(path.resolve(requested));
    } catch {
      return Result.fail(new ValidationError(`"${requested}" does not exist`));
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(resolved);
    } catch {
      return Result.fail(new ValidationError(`"${resolved}" cannot be read`));
    }

    if (!stat.isDirectory()) {
      return Result.fail(new ValidationError(`"${resolved}" is not a directory`));
    }

    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(resolved, { withFileTypes: true });
    } catch {
      return Result.fail(new ValidationError(`"${resolved}" cannot be listed`));
    }

    const entries: DirectoryEntry[] = [];
    for (const dirent of dirents) {
      // Symlinked directories are offered too — a checkout reached through a link is still a
      // checkout — but the link is resolved on the way in, not here.
      if (!dirent.isDirectory() && !dirent.isSymbolicLink()) {
        continue;
      }
      if (dirent.name.startsWith(".")) {
        continue;
      }

      const entryPath = path.join(resolved, dirent.name);
      const readable = this.isReadableDirectory(entryPath);

      entries.push({
        name: dirent.name,
        path: entryPath,
        isWebinyProject: readable && hasWebinyMarker(entryPath),
        readable,
      });
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    const parent = path.dirname(resolved);

    return Result.ok({
      path: resolved,
      parentPath: parent === resolved ? null : parent,
      isWebinyProject: hasWebinyMarker(resolved),
      entries,
    });
  }

  private isReadableDirectory(entryPath: string): boolean {
    try {
      return fs.statSync(entryPath).isDirectory();
    } catch {
      return false;
    }
  }
}

export const DirectoryBrowser = Abstraction.createImplementation({
  implementation: DirectoryBrowserImpl,
  dependencies: [],
});
