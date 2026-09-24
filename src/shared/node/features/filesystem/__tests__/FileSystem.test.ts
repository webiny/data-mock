import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { CreateScanRootRepository } from "~/shared/node/features/scanRoots/create/abstractions/CreateScanRootRepository.js";
import { ListScanRootsRepository } from "~/shared/node/features/scanRoots/list/abstractions/ListScanRootsRepository.js";
import { RemoveScanRootRepository } from "~/shared/node/features/scanRoots/remove/abstractions/RemoveScanRootRepository.js";
import { DirectoryBrowser } from "../browse/abstractions/DirectoryBrowser.js";
import { ProjectScanner } from "../scan/abstractions/ProjectScanner.js";

function makeProject(root: string, name: string, marker = "webiny.config.tsx"): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, marker), "export default {};\n");
  return dir;
}

describe("FileSystem", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let tmp: string;

  beforeEach(() => {
    tc = createTestContainer();
    // realpathSync: on macOS the temp dir is itself a symlink, and the browser returns real paths.
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fs-test-")));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    tc.cleanup();
  });

  describe("DirectoryBrowser", () => {
    it("lists subdirectories and flags Webiny projects", async () => {
      makeProject(tmp, "a-project");
      fs.mkdirSync(path.join(tmp, "b-plain"));

      const browser = tc.container.resolve(DirectoryBrowser);
      const result = await browser.execute({ path: tmp });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.entries.map((e) => e.name)).toEqual(["a-project", "b-plain"]);
        expect(result.value.entries[0]?.isWebinyProject).toBe(true);
        expect(result.value.entries[1]?.isWebinyProject).toBe(false);
        expect(result.value.parentPath).toBe(path.dirname(tmp));
      }
    });

    it("omits files, so it can never be used to read one", async () => {
      fs.writeFileSync(path.join(tmp, "secret.txt"), "contents");

      const browser = tc.container.resolve(DirectoryBrowser);
      const result = await browser.execute({ path: tmp });

      expect(result.isOk() && result.value.entries).toHaveLength(0);
    });

    it("omits dotted directories", async () => {
      fs.mkdirSync(path.join(tmp, ".ssh"));

      const browser = tc.container.resolve(DirectoryBrowser);
      const result = await browser.execute({ path: tmp });

      expect(result.isOk() && result.value.entries).toHaveLength(0);
    });

    it("rejects a relative path", async () => {
      const browser = tc.container.resolve(DirectoryBrowser);
      const result = await browser.execute({ path: "relative/path" });

      expect(result.isFail()).toBe(true);
    });

    it("rejects a file", async () => {
      const file = path.join(tmp, "a-file");
      fs.writeFileSync(file, "x");

      const browser = tc.container.resolve(DirectoryBrowser);
      const result = await browser.execute({ path: file });

      expect(result.isFail()).toBe(true);
    });

    it("rejects a path that does not exist", async () => {
      const browser = tc.container.resolve(DirectoryBrowser);
      const result = await browser.execute({ path: path.join(tmp, "missing") });

      expect(result.isFail()).toBe(true);
    });

    it("defaults to the home directory when given no path", async () => {
      const browser = tc.container.resolve(DirectoryBrowser);
      const result = await browser.execute({});

      expect(result.isOk() && result.value.path).toBe(fs.realpathSync(os.homedir()));
    });
  });

  describe("ScanRoots", () => {
    it("resolves the path and returns the existing row for a duplicate", async () => {
      const create = tc.container.resolve(CreateScanRootRepository);

      const first = await create.execute({ path: tmp });
      const second = await create.execute({ path: `${tmp}/` });

      expect(first.isOk() && second.isOk()).toBe(true);
      if (first.isOk() && second.isOk()) {
        expect(second.value.id).toBe(first.value.id);
      }

      const list = await tc.container.resolve(ListScanRootsRepository).execute();
      expect(list.isOk() && list.value).toHaveLength(1);
    });

    it("rejects a path that is not a directory", async () => {
      const create = tc.container.resolve(CreateScanRootRepository);
      const result = await create.execute({ path: path.join(tmp, "missing") });

      expect(result.isFail()).toBe(true);
    });

    it("removes a root, and fails for an unknown one", async () => {
      const create = tc.container.resolve(CreateScanRootRepository);
      const remove = tc.container.resolve(RemoveScanRootRepository);

      const created = await create.execute({ path: tmp });
      if (created.isFail()) {
        throw new Error("Failed to create scan root");
      }

      expect((await remove.execute({ id: created.value.id })).isOk()).toBe(true);
      expect((await remove.execute({ id: created.value.id })).isFail()).toBe(true);
    });
  });

  describe("ProjectScanner", () => {
    it("finds projects below a root and stops descending at the first marker", async () => {
      const outer = makeProject(tmp, "outer");
      // A checkout's own apps are not separate projects, even when they carry a marker.
      makeProject(outer, "apps");
      makeProject(path.join(outer, "apps"), "core");

      const nested = path.join(tmp, "group", "inner");
      fs.mkdirSync(nested, { recursive: true });
      fs.writeFileSync(path.join(nested, "webiny.project.ts"), "export default {};\n");

      const scanner = tc.container.resolve(ProjectScanner);
      const result = await scanner.execute({ paths: [tmp] });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.candidates.map((c) => c.rootPath)).toEqual([nested, outer]);
        expect(result.value.errors).toHaveLength(0);
      }
    });

    it("never descends into node_modules", async () => {
      const modules = path.join(tmp, "node_modules", "@webiny", "cli");
      fs.mkdirSync(modules, { recursive: true });
      fs.writeFileSync(path.join(modules, "webiny.config.tsx"), "export default {};\n");

      const scanner = tc.container.resolve(ProjectScanner);
      const result = await scanner.execute({ paths: [tmp], maxDepth: 8 });

      expect(result.isOk() && result.value.candidates).toHaveLength(0);
    });

    it("flags a checkout that is already registered", async () => {
      const project = makeProject(tmp, "registered");

      const created = await tc.container.resolve(CreateProjectUseCase).execute({
        name: "Registered",
        rootPath: project,
      });
      if (created.isFail()) {
        throw new Error("Failed to create project");
      }

      const scanner = tc.container.resolve(ProjectScanner);
      const result = await scanner.execute({ paths: [tmp] });

      expect(result.isOk() && result.value.candidates[0]?.registered).toBe(true);
    });

    it("uses the stored scan roots when given no paths", async () => {
      makeProject(tmp, "from-root");
      await tc.container.resolve(CreateScanRootRepository).execute({ path: tmp });

      const scanner = tc.container.resolve(ProjectScanner);
      const result = await scanner.execute({});

      expect(result.isOk() && result.value.candidates).toHaveLength(1);
    });

    it("reports an unreadable root instead of returning silently", async () => {
      const scanner = tc.container.resolve(ProjectScanner);
      const result = await scanner.execute({ paths: [path.join(tmp, "missing")] });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.candidates).toHaveLength(0);
        expect(result.value.errors).toHaveLength(1);
      }
    });

    it("rejects a relative path", async () => {
      const scanner = tc.container.resolve(ProjectScanner);
      const result = await scanner.execute({ paths: ["relative"] });

      expect(result.isFail()).toBe(true);
    });
  });
});
