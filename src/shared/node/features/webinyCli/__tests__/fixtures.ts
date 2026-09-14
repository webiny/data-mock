import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface IFixtureStack {
  app: string;
  stackName: string;
  /** Omit for a destroyed stack: the file exists but carries no `resources` key. */
  resources?: Array<Record<string, unknown>>;
}

export interface IFixtureProject {
  marker: "webiny.config.tsx" | "webiny.project.ts";
  packageJson?: Record<string, unknown>;
  env?: Record<string, string>;
  apps?: string[];
  stacks?: IFixtureStack[];
  projectFileContents?: string;
}

/** Builds a throwaway Webiny-shaped directory tree. Returns its path plus a cleanup function. */
export function createFixtureProject(fixture: IFixtureProject): {
  rootPath: string;
  cleanup: () => void;
} {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "webiny-fixture-"));

  fs.writeFileSync(
    path.join(rootPath, fixture.marker),
    fixture.projectFileContents ?? "export default {};\n",
  );

  if (fixture.packageJson) {
    fs.writeFileSync(
      path.join(rootPath, "package.json"),
      JSON.stringify(fixture.packageJson, null, 2),
    );
  }

  if (fixture.env) {
    const body = Object.entries(fixture.env)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    fs.writeFileSync(path.join(rootPath, ".env"), body);
  }

  for (const app of fixture.apps ?? []) {
    fs.mkdirSync(path.join(rootPath, "apps", app), { recursive: true });
  }

  for (const stack of fixture.stacks ?? []) {
    const dir = path.join(rootPath, ".pulumi", "apps", stack.app, ".pulumi", "stacks", stack.app);
    fs.mkdirSync(dir, { recursive: true });
    const checkpoint: Record<string, unknown> = { version: 3, checkpoint: { latest: {} } };
    if (stack.resources) {
      (checkpoint["checkpoint"] as Record<string, Record<string, unknown>>)["latest"] = {
        resources: stack.resources,
      };
    }
    fs.writeFileSync(path.join(dir, `${stack.stackName}.json`), JSON.stringify(checkpoint));
  }

  return { rootPath, cleanup: () => fs.rmSync(rootPath, { recursive: true, force: true }) };
}

export function stackResource(outputs: Record<string, unknown>): Record<string, unknown> {
  return { type: "pulumi:pulumi:Stack", outputs };
}
