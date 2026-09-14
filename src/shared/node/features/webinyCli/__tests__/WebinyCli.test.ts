import { describe, it, expect } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { WebinyProjectDetector } from "../detect/abstractions/WebinyProjectDetector.js";
import { PulumiCheckpointReader } from "../checkpoint/abstractions/PulumiCheckpointReader.js";
import { createFixtureProject, stackResource } from "./fixtures.js";

function withContainer<T>(fn: (tc: ReturnType<typeof createTestContainer>) => Promise<T> | T) {
  const tc = createTestContainer();
  return Promise.resolve(fn(tc)).finally(() => tc.cleanup());
}

describe("WebinyProjectDetector", () => {
  it("detects a v6 project by its marker file", async () => {
    const fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      packageJson: { dependencies: { "@webiny/cli": "6.4.9" } },
    });
    try {
      await withContainer(async (tc) => {
        const detector = tc.container.resolve(WebinyProjectDetector);
        const result = await detector.execute({ rootPath: fixture.rootPath });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.isWebinyProject).toBe(true);
          expect(result.value.versionMajor).toBe(6);
          expect(result.value.webinyVersion).toBe("6.4.9");
          expect(result.value.versionSource).toBe("package-json");
        }
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("detects a v5 project and reads its version from the template field", async () => {
    const fixture = createFixtureProject({
      marker: "webiny.project.ts",
      projectFileContents: `export default { template: "@webiny/cwp-template-aws@5.44.2" };`,
      apps: ["core", "api", "admin", "website"],
    });
    try {
      await withContainer(async (tc) => {
        const detector = tc.container.resolve(WebinyProjectDetector);
        const result = await detector.execute({ rootPath: fixture.rootPath });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.versionMajor).toBe(5);
          expect(result.value.webinyVersion).toBe("5.44.2");
          expect(result.value.versionSource).toBe("template-field");
          expect(result.value.apps).toEqual(["core", "api", "admin", "website"]);
        }
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("reports no version for a workspace root rather than a fabricated 0.0.0", async () => {
    // @webiny/cli resolves to 0.0.0 inside the framework monorepo. Reporting that as a version
    // would read as real and would drive the operation registry to its lowest entry.
    const fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      packageJson: { private: true, workspaces: ["packages/*"] },
    });
    try {
      await withContainer(async (tc) => {
        const detector = tc.container.resolve(WebinyProjectDetector);
        const result = await detector.execute({ rootPath: fixture.rootPath });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.isWebinyProject).toBe(true);
          expect(result.value.webinyVersion).toBeNull();
          expect(result.value.versionSource).toBe("workspace-root");
        }
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("offers the v6 app set even when nothing has been deployed", async () => {
    // .pulumi/apps is created on first login, so a fresh checkout has none — reading it would
    // leave the deploy form with nothing to offer.
    const fixture = createFixtureProject({ marker: "webiny.config.tsx" });
    try {
      await withContainer(async (tc) => {
        const detector = tc.container.resolve(WebinyProjectDetector);
        const result = await detector.execute({ rootPath: fixture.rootPath });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.apps).toEqual(["core", "api", "admin"]);
        }
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("reads the backend variable its own major actually honours", async () => {
    const v5 = createFixtureProject({
      marker: "webiny.project.ts",
      env: { WEBINY_PULUMI_BACKEND: "s3://v5-bucket" },
    });
    const v6 = createFixtureProject({
      marker: "webiny.config.tsx",
      env: { WEBINY_CLI_PULUMI_BACKEND: "s3://v6-bucket" },
    });
    try {
      await withContainer(async (tc) => {
        const detector = tc.container.resolve(WebinyProjectDetector);

        const v5Result = await detector.execute({ rootPath: v5.rootPath });
        const v6Result = await detector.execute({ rootPath: v6.rootPath });

        expect(v5Result.isOk() && v5Result.value.pulumiBackend).toBe("s3://v5-bucket");
        expect(v5Result.isOk() && v5Result.value.remoteBackend).toBe(true);
        expect(v6Result.isOk() && v6Result.value.pulumiBackend).toBe("s3://v6-bucket");
        expect(v6Result.isOk() && v6Result.value.remoteBackend).toBe(true);
      });
    } finally {
      v5.cleanup();
      v6.cleanup();
    }
  });

  it("reports a non-Webiny directory as such", async () => {
    await withContainer(async (tc) => {
      const detector = tc.container.resolve(WebinyProjectDetector);
      const result = await detector.execute({ rootPath: process.cwd() });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.isWebinyProject).toBe(false);
        expect(result.value.versionMajor).toBeNull();
      }
    });
  });

  it("fails for a path that is not a directory", async () => {
    await withContainer(async (tc) => {
      const detector = tc.container.resolve(WebinyProjectDetector);
      const result = await detector.execute({ rootPath: "/does/not/exist" });

      expect(result.isFail()).toBe(true);
    });
  });
});

describe("PulumiCheckpointReader", () => {
  it("reads outputs from a deployed stack", async () => {
    const fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      stacks: [
        {
          app: "api",
          stackName: "dev",
          resources: [
            { type: "aws:s3/bucket:Bucket" },
            stackResource({ apiUrl: "https://example.cloudfront.net", region: "eu-central-1" }),
          ],
        },
      ],
    });
    try {
      await withContainer(async (tc) => {
        const reader = tc.container.resolve(PulumiCheckpointReader);
        const result = reader.read({
          rootPath: fixture.rootPath,
          app: "api",
          env: "dev",
          variant: "",
        });

        expect(result.readState).toBe("deployed");
        expect(result.deployed).toBe(true);
        expect(result.resourceCount).toBe(2);
        expect(result.outputs?.["apiUrl"]).toBe("https://example.cloudfront.net");
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("treats a destroyed stack as not-deployed, not as unknown", async () => {
    // Destroy leaves the file behind with no `resources` key. Both CLI versions report {} here,
    // which is why deployment is decided on the resources array rather than on output emptiness.
    const fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      stacks: [{ app: "core", stackName: "dev" }],
    });
    try {
      await withContainer(async (tc) => {
        const reader = tc.container.resolve(PulumiCheckpointReader);
        const result = reader.read({
          rootPath: fixture.rootPath,
          app: "core",
          env: "dev",
          variant: "",
        });

        expect(result.readState).toBe("not-deployed");
        expect(result.deployed).toBe(false);
        expect(result.resourceCount).toBe(0);
        expect(result.error).toBeNull();
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("reports a missing stack file as unknown so good data is never overwritten", async () => {
    const fixture = createFixtureProject({ marker: "webiny.config.tsx" });
    try {
      await withContainer(async (tc) => {
        const reader = tc.container.resolve(PulumiCheckpointReader);
        const result = reader.read({
          rootPath: fixture.rootPath,
          app: "core",
          env: "dev",
          variant: "",
        });

        expect(result.readState).toBe("unknown");
        expect(result.resourceCount).toBeNull();
        expect(result.error).toContain("No stack file");
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("reports an unparseable checkpoint as unknown", async () => {
    const fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      stacks: [{ app: "core", stackName: "dev", resources: [] }],
    });
    const fs = await import("node:fs");
    const path = await import("node:path");
    fs.writeFileSync(
      path.join(fixture.rootPath, ".pulumi/apps/core/.pulumi/stacks/core/dev.json"),
      "{ not json",
    );
    try {
      await withContainer(async (tc) => {
        const reader = tc.container.resolve(PulumiCheckpointReader);
        const result = reader.read({
          rootPath: fixture.rootPath,
          app: "core",
          env: "dev",
          variant: "",
        });

        expect(result.readState).toBe("unknown");
        expect(result.error).toContain("Could not parse");
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("masks secret outputs rather than emitting ciphertext", async () => {
    const fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      stacks: [
        {
          app: "core",
          stackName: "dev",
          resources: [
            stackResource({
              plain: "visible",
              hidden: { "4dabf18193072939515e22adb298388d": "sig", ciphertext: "v1:abc" },
            }),
          ],
        },
      ],
    });
    try {
      await withContainer(async (tc) => {
        const reader = tc.container.resolve(PulumiCheckpointReader);
        const result = reader.read({
          rootPath: fixture.rootPath,
          app: "core",
          env: "dev",
          variant: "",
        });

        expect(result.outputs?.["plain"]).toBe("visible");
        expect(result.outputs?.["hidden"]).toBe("(secret)");
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("discovers environments from core stack files, including variants", async () => {
    const fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      stacks: [
        { app: "core", stackName: "dev", resources: [stackResource({})] },
        { app: "core", stackName: "prod", resources: [stackResource({})] },
        { app: "core", stackName: "dev___blue", resources: [stackResource({})] },
        // api stacks must not introduce environments of their own
        { app: "api", stackName: "staging", resources: [stackResource({})] },
      ],
    });
    try {
      await withContainer(async (tc) => {
        const reader = tc.container.resolve(PulumiCheckpointReader);
        const environments = reader.listEnvironments(fixture.rootPath);

        expect(environments).toEqual([
          { env: "dev", variant: "" },
          { env: "dev", variant: "blue" },
          { env: "prod", variant: "" },
        ]);
      });
    } finally {
      fixture.cleanup();
    }
  });
});
