import fs from "node:fs";
import path from "node:path";
import { Result } from "@webiny/stdlib";
import { WebinyProjectDetector as Abstraction } from "./abstractions/WebinyProjectDetector.js";
import { ValidationError } from "~/shared/errors.js";
import type { VersionSource } from "~/shared/types.js";

/** v6 marks a project root with this file, and only this exact name. */
const V6_MARKER = "webiny.config.tsx";
/** v5 markers, newest first. `webiny.root.js` is the legacy one. */
const V5_MARKERS = ["webiny.project.ts", "webiny.project.js", "webiny.root.js"];

/**
 * v6's deployable apps are a fixed constant (`APP_NAME` in @webiny/project), not a directory
 * listing. `.pulumi/apps/` only tells you which apps have state — it is created on first login, so
 * a registered-but-never-deployed checkout has none, and reading it would offer nothing to deploy.
 */
const V6_APPS = ["core", "api", "admin"];
const V5_KNOWN_APPS = ["core", "api", "admin", "website"];

const REMOTE_SCHEMES = ["s3://", "azblob://", "gs://"];

/**
 * Webiny's own sentinel for "no version" — @webiny/cli resolves to this inside the framework
 * monorepo, so it must not be reported as a real version.
 */
const NO_VERSION = "0.0.0";

class WebinyProjectDetectorImpl implements Abstraction.Interface {
  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, ValidationError>> {
    const rootPath = path.resolve(input.rootPath);

    if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
      return Result.fail(new ValidationError(`"${rootPath}" is not a directory`));
    }

    const versionMajor = this.detectMajor(rootPath);

    if (versionMajor === null) {
      return Result.ok({
        isWebinyProject: false,
        versionMajor: null,
        webinyVersion: null,
        versionSource: null,
        apps: [],
        pulumiBackend: null,
        remoteBackend: false,
      });
    }

    const version = this.detectVersion(rootPath, versionMajor);
    const backend = this.detectBackend(rootPath, versionMajor);

    return Result.ok({
      isWebinyProject: true,
      versionMajor,
      webinyVersion: version.value,
      versionSource: version.source,
      apps: this.detectApps(rootPath, versionMajor),
      pulumiBackend: backend,
      remoteBackend: backend !== null && REMOTE_SCHEMES.some((s) => backend.startsWith(s)),
    });
  }

  private detectMajor(rootPath: string): number | null {
    if (fs.existsSync(path.join(rootPath, V6_MARKER))) {
      return 6;
    }
    if (V5_MARKERS.some((marker) => fs.existsSync(path.join(rootPath, marker)))) {
      return 5;
    }
    return null;
  }

  /**
   * Mirrors Webiny's own resolver and then extends it. Framework workspace roots legitimately have
   * no version — reporting "0.0.0" would be worse than reporting nothing, because it reads as a
   * real version and drives the operation registry to its lowest entry.
   */
  private detectVersion(
    rootPath: string,
    versionMajor: number,
  ): { value: string | null; source: VersionSource | null } {
    const envVersion = this.readEnvValue(rootPath, "WEBINY_VERSION");
    if (envVersion !== null && envVersion !== NO_VERSION) {
      return { value: envVersion, source: "env-var" };
    }

    const packageJson = this.readJson(path.join(rootPath, "package.json"));
    if (packageJson) {
      const deps = {
        ...(packageJson["dependencies"] as Record<string, string> | undefined),
        ...(packageJson["devDependencies"] as Record<string, string> | undefined),
      };
      const declared = deps["@webiny/cli"] ?? deps["@webiny/cli-aws"];
      if (declared) {
        const cleaned = declared.replace(/^[\^~]/, "");
        if (cleaned !== NO_VERSION) {
          return { value: cleaned, source: "package-json" };
        }
      }
    }

    const installed = this.readJson(
      path.join(rootPath, "node_modules", "@webiny", "cli", "package.json"),
    );
    const installedVersion = installed?.["version"];
    if (typeof installedVersion === "string" && installedVersion !== NO_VERSION) {
      return { value: installedVersion, source: "node-modules" };
    }

    if (versionMajor === 5) {
      const fromTemplate = this.readV5Template(rootPath);
      if (fromTemplate !== null) {
        return { value: fromTemplate, source: "template-field" };
      }
    }

    return { value: null, source: "workspace-root" };
  }

  private readV5Template(rootPath: string): string | null {
    for (const marker of V5_MARKERS) {
      const file = path.join(rootPath, marker);
      if (!fs.existsSync(file)) {
        continue;
      }
      const match = /@webiny\/cwp-template-aws@([\d.]+)/.exec(fs.readFileSync(file, "utf-8"));
      if (match?.[1]) {
        return match[1];
      }
    }
    return null;
  }

  private detectApps(rootPath: string, versionMajor: number): string[] {
    if (versionMajor === 6) {
      return [...V6_APPS];
    }

    // v5 apps live on disk, but only those the project also aliases are invocable: the alias map
    // can name an app that was never scaffolded (webiny-v5 declares blueGreen with no folder).
    const appsDir = path.join(rootPath, "apps");
    if (!fs.existsSync(appsDir)) {
      return [];
    }
    const onDisk = fs
      .readdirSync(appsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    const aliases = this.readV5Aliases(rootPath);
    const invocable = aliases === null ? onDisk : onDisk.filter((app) => aliases.includes(app));

    return V5_KNOWN_APPS.filter((app) => invocable.includes(app)).concat(
      invocable.filter((app) => !V5_KNOWN_APPS.includes(app)),
    );
  }

  private readV5Aliases(rootPath: string): string[] | null {
    for (const marker of V5_MARKERS) {
      const file = path.join(rootPath, marker);
      if (!fs.existsSync(file)) {
        continue;
      }
      const block = /appAliases\s*:\s*\{([^}]*)\}/s.exec(fs.readFileSync(file, "utf-8"));
      if (!block?.[1]) {
        continue;
      }
      return [...block[1].matchAll(/(\w+)\s*:/g)].map((match) => match[1] as string);
    }
    return null;
  }

  /**
   * The two majors read different variable names, and v6's IsRemotePulumiBackendService consults a
   * wider list than PulumiLoginService actually honours. Detect on the login list — those are the
   * variables that decide where state really goes.
   */
  private detectBackend(rootPath: string, versionMajor: number): string | null {
    const names =
      versionMajor === 6
        ? ["WEBINY_CLI_PULUMI_BACKEND", "WEBINY_PULUMI_BACKEND"]
        : ["WEBINY_PULUMI_BACKEND", "WEBINY_PULUMI_BACKEND_URL", "PULUMI_LOGIN"];

    for (const name of names) {
      const value = this.readEnvValue(rootPath, name);
      if (value !== null && value !== "") {
        return value;
      }
    }
    return null;
  }

  private readEnvValue(rootPath: string, key: string): string | null {
    const file = path.join(rootPath, ".env");
    if (!fs.existsSync(file)) {
      return null;
    }
    for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) {
        continue;
      }
      const index = trimmed.indexOf("=");
      if (index === -1 || trimmed.slice(0, index).trim() !== key) {
        continue;
      }
      return trimmed
        .slice(index + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
    return null;
  }

  private readJson(file: string): Record<string, unknown> | null {
    if (!fs.existsSync(file)) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export const WebinyProjectDetector = Abstraction.createImplementation({
  implementation: WebinyProjectDetectorImpl,
  dependencies: [],
});
