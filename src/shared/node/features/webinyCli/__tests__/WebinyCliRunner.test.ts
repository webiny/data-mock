import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { childProcesses } from "~/shared/node/db/schema.js";
import { isAlive } from "~/shared/node/features/childProcesses/processGroup.js";
import { WebinyCliRunner } from "../runner/abstractions/WebinyCliRunner.js";
import { buildChildEnv } from "../runner/buildChildEnv.js";
import { parseJsonOutput } from "../runner/parseJsonOutput.js";
import { stripAnsi } from "../runner/stripAnsi.js";
import {
  buildWebinyCommand,
  orderAppsForDeploy,
  orderAppsForDestroy,
} from "../command/webinyCommandBuilder.js";

const ESC = String.fromCharCode(27);

describe("buildChildEnv", () => {
  it("keeps every AWS_* credential variable", () => {
    const env = buildChildEnv({
      parentEnv: {
        AWS_ACCESS_KEY_ID: "key",
        AWS_SESSION_TOKEN: "token",
        AWS_DEFAULT_REGION: "eu-central-1",
        AWS_ROLE_ARN: "arn",
        AWS_WEB_IDENTITY_TOKEN_FILE: "/tmp/token",
        AWS_CONTAINER_CREDENTIALS_FULL_URI: "http://169.254.170.2",
      },
    });

    expect(env["AWS_ACCESS_KEY_ID"]).toBe("key");
    expect(env["AWS_SESSION_TOKEN"]).toBe("token");
    expect(env["AWS_DEFAULT_REGION"]).toBe("eu-central-1");
    expect(env["AWS_ROLE_ARN"]).toBe("arn");
    expect(env["AWS_WEB_IDENTITY_TOKEN_FILE"]).toBe("/tmp/token");
    expect(env["AWS_CONTAINER_CREDENTIALS_FULL_URI"]).toBe("http://169.254.170.2");
  });

  it("strips WEBINY_* and PULUMI_* so the project's own .env wins", () => {
    const env = buildChildEnv({
      parentEnv: {
        WEBINY_PULUMI_BACKEND: "s3://server-level",
        WEBINY_ENV: "prod",
        PULUMI_CONFIG_PASSPHRASE: "server-level",
        PULUMI_HOME: "/server/pulumi",
      },
    });

    expect(env["WEBINY_PULUMI_BACKEND"]).toBeUndefined();
    expect(env["WEBINY_ENV"]).toBeUndefined();
    expect(env["PULUMI_CONFIG_PASSPHRASE"]).toBeUndefined();
    expect(env["PULUMI_HOME"]).toBeUndefined();
  });

  it("does not inherit AWS_PROFILE or AWS_REGION, and sets them per project", () => {
    const env = buildChildEnv({
      parentEnv: { AWS_PROFILE: "inherited", AWS_REGION: "us-east-1" },
      awsProfile: "project-profile",
      awsRegion: "eu-central-1",
    });

    expect(env["AWS_PROFILE"]).toBe("project-profile");
    expect(env["AWS_REGION"]).toBe("eu-central-1");
  });

  it("leaves AWS_PROFILE unset when the project does not name one", () => {
    const env = buildChildEnv({ parentEnv: { AWS_PROFILE: "inherited" } });

    expect(env["AWS_PROFILE"]).toBeUndefined();
  });

  it("keeps HOME and PATH, which corepack needs", () => {
    const env = buildChildEnv({ parentEnv: { HOME: "/Users/x", PATH: "/usr/bin" } });

    expect(env["HOME"]).toBe("/Users/x");
    expect(env["PATH"]).toBe("/usr/bin");
  });

  it("keeps NODE_EXTRA_CA_CERTS but not NODE_ENV or NODE_OPTIONS", () => {
    const env = buildChildEnv({
      parentEnv: {
        NODE_EXTRA_CA_CERTS: "/certs/ca.pem",
        NODE_ENV: "test",
        NODE_OPTIONS: "--max-old-space-size=99",
      },
    });

    expect(env["NODE_EXTRA_CA_CERTS"]).toBe("/certs/ca.pem");
    expect(env["NODE_ENV"]).toBeUndefined();
    expect(env["NODE_OPTIONS"]).toBeUndefined();
  });

  it("sets CI=1, which v6 needs to get past its telemetry gate", () => {
    const env = buildChildEnv({ parentEnv: {} });

    expect(env["CI"]).toBe("1");
    expect(env["NO_COLOR"]).toBe("1");
    expect(env["FORCE_COLOR"]).toBe("0");
    expect(env["BROWSER"]).toBe("none");
  });

  it("drops anything not on the allow-list", () => {
    const env = buildChildEnv({ parentEnv: { SOME_SECRET: "leak", DATABASE_URL: "postgres://" } });

    expect(env["SOME_SECRET"]).toBeUndefined();
    expect(env["DATABASE_URL"]).toBeUndefined();
  });
});

describe("parseJsonOutput", () => {
  it("finds JSON buried in other CLI chatter", () => {
    const output = 'Building...\nDone in 3s\n{"apiUrl":"https://example.com"}\nFinished.\n';

    expect(parseJsonOutput(output)).toEqual({ apiUrl: "https://example.com" });
  });

  it("takes the last value, because banners can contain braces too", () => {
    const output = '{"first":1}\nnoise\n{"second":2}\n';

    expect(parseJsonOutput(output)).toEqual({ second: 2 });
  });

  it("treats a literal null as a value, not as nothing found", () => {
    // Both majors print JSON.stringify(null) for a stack that does not exist. The caller must read
    // that as unknown, never as not-deployed.
    expect(parseJsonOutput("Loading...\nnull\n")).toBeNull();
  });

  it("returns undefined when there is nothing parseable", () => {
    expect(parseJsonOutput("No output values found.\n")).toBeUndefined();
  });

  it("ignores braces inside strings", () => {
    const output = '{"message":"a } brace","ok":true}';

    expect(parseJsonOutput(output)).toEqual({ message: "a } brace", ok: true });
  });

  it("ignores an escaped quote inside a string", () => {
    const output = '{"message":"say \\"hi\\"","ok":true}';

    expect(parseJsonOutput(output)).toEqual({ message: 'say "hi"', ok: true });
  });

  it("does not match null inside a word or a quoted value", () => {
    expect(parseJsonOutput("field is nullable\n")).toBeUndefined();
    expect(parseJsonOutput('{"a":"null"}')).toEqual({ a: "null" });
  });

  it("skips an unterminated opening brace and keeps scanning", () => {
    expect(parseJsonOutput('{ truncated\n{"ok":true}')).toEqual({ ok: true });
  });

  it("returns an empty object for an existing but empty stack", () => {
    // Not the same as null: {} means the stack exists and has no outputs.
    expect(parseJsonOutput("{}")).toEqual({});
  });
});

describe("stripAnsi", () => {
  it("removes colour codes and a trailing carriage return", () => {
    expect(stripAnsi(`${ESC}[32mdone${ESC}[0m\r`)).toBe("done");
  });

  it("leaves plain text alone", () => {
    expect(stripAnsi("plain text")).toBe("plain text");
  });
});

describe("buildWebinyCommand", () => {
  it("builds a v6 deploy", () => {
    const result = buildWebinyCommand({
      command: "deploy",
      versionMajor: 6,
      app: "api",
      env: "dev",
    });

    expect(result.isOk() && result.value).toEqual([
      "deploy",
      "api",
      "--env=dev",
      "--build",
      "--show-deployment-logs",
    ]);
  });

  it("uses the v5 deployment-logs flag name", () => {
    const result = buildWebinyCommand({
      command: "deploy",
      versionMajor: 5,
      app: "api",
      env: "dev",
    });

    expect(result.isOk() && result.value).toContain("--deployment-logs");
    expect(result.isOk() && result.value).not.toContain("--show-deployment-logs");
  });

  it("adds --preview only on deploy, and keeps --build with it", () => {
    const deploy = buildWebinyCommand({
      command: "deploy",
      versionMajor: 6,
      app: "core",
      env: "dev",
      preview: true,
    });

    // --build stays on: pulumi plans against the built app code, so skipping it would preview a
    // stack shaped by whatever happens to be in the workspace.
    expect(deploy.isOk() && deploy.value).toEqual([
      "deploy",
      "core",
      "--env=dev",
      "--build",
      "--show-deployment-logs",
      "--preview",
    ]);

    const destroy = buildWebinyCommand({
      command: "destroy",
      versionMajor: 6,
      app: "core",
      env: "dev",
      preview: true,
    });

    expect(destroy.isOk() && destroy.value).toEqual(["destroy", "core", "--env=dev"]);
  });

  it("passes variant and region when given", () => {
    const result = buildWebinyCommand({
      command: "deploy",
      versionMajor: 6,
      app: "core",
      env: "dev",
      variant: "blue",
      region: "eu-central-1",
    });

    expect(result.isOk() && result.value).toEqual([
      "deploy",
      "core",
      "--env=dev",
      "--variant=blue",
      "--region=eu-central-1",
      "--build",
      "--show-deployment-logs",
    ]);
  });

  it("sends no build or log flags to destroy, which declares neither on either major", () => {
    for (const versionMajor of [5, 6]) {
      const result = buildWebinyCommand({
        command: "destroy",
        versionMajor,
        app: "admin",
        env: "dev",
      });

      expect(result.isOk() && result.value).toEqual(["destroy", "admin", "--env=dev"]);
    }
  });

  it("always passes --json to output", () => {
    const result = buildWebinyCommand({
      command: "output",
      versionMajor: 6,
      app: "api",
      env: "dev",
    });

    expect(result.isOk() && result.value).toEqual(["output", "api", "--env=dev", "--json"]);
  });

  it("refuses to build a command with no app", () => {
    // Omitting the app makes v6 destroy admin, api and core with no confirmation at all.
    const result = buildWebinyCommand({
      command: "destroy",
      versionMajor: 6,
      app: "",
      env: "dev",
    });

    expect(result.isFail()).toBe(true);
  });

  it("rejects the reserved variant names", () => {
    for (const variant of ["none", "empty", "blank", "BLANK"]) {
      const result = buildWebinyCommand({
        command: "deploy",
        versionMajor: 6,
        app: "api",
        env: "dev",
        variant,
      });

      expect(result.isFail()).toBe(true);
    }
  });

  it("rejects an unsupported major version", () => {
    const result = buildWebinyCommand({
      command: "deploy",
      versionMajor: 4,
      app: "api",
      env: "dev",
    });

    expect(result.isFail()).toBe(true);
  });
});

describe("app ordering", () => {
  it("deploys core before api before admin", () => {
    expect(orderAppsForDeploy(["admin", "core", "api"])).toEqual(["core", "api", "admin"]);
  });

  it("destroys in the reverse order", () => {
    expect(orderAppsForDestroy(["core", "api", "admin"])).toEqual(["admin", "api", "core"]);
  });

  it("puts an unknown app last, never before core", () => {
    expect(orderAppsForDeploy(["blueGreen", "core"])).toEqual(["core", "blueGreen"]);
  });
});

describe("WebinyCliRunner", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let tmp: string;

  beforeEach(() => {
    tc = createTestContainer();
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cli-runner-")));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    tc.cleanup();
  });

  /**
   * Installs a fake `webiny` binary in the checkout, so the runner exercises its real spawn path
   * without needing a Webiny project or touching AWS.
   */
  function installFakeBinary(script: string): void {
    const binDir = path.join(tmp, "node_modules", ".bin");
    fs.mkdirSync(binDir, { recursive: true });
    const file = path.join(binDir, "webiny");
    fs.writeFileSync(file, `#!/usr/bin/env node\n${script}\n`);
    fs.chmodSync(file, 0o755);
  }

  it("runs the project's own binary and returns its output", async () => {
    installFakeBinary(`console.log("hello from " + process.argv.slice(2).join(" "));`);

    const runner = tc.container.resolve(WebinyCliRunner);
    const result = await runner.execute({ rootPath: tmp, args: ["deploy", "api"] });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.stdout.trim()).toBe("hello from deploy api");
      expect(result.value.exitCode).toBe(0);
    }
  });

  it("streams stdout and stderr as lines, ANSI stripped", async () => {
    installFakeBinary(
      `console.log("\\u001b[32mfirst\\u001b[0m");console.error("second");console.log("third");`,
    );

    const lines: string[] = [];
    const runner = tc.container.resolve(WebinyCliRunner);
    const result = await runner.execute({
      rootPath: tmp,
      args: ["deploy", "api"],
      onLine: (line) => lines.push(line),
    });

    expect(result.isOk()).toBe(true);
    expect(lines.sort()).toEqual(["first", "second", "third"]);
  });

  it("emits a final line that has no trailing newline", async () => {
    installFakeBinary(`process.stdout.write("no newline at the end");`);

    const lines: string[] = [];
    const runner = tc.container.resolve(WebinyCliRunner);
    await runner.execute({
      rootPath: tmp,
      args: ["output", "api"],
      onLine: (line) => lines.push(line),
    });

    expect(lines).toEqual(["no newline at the end"]);
  });

  it("fails with the exit code and the tail of the output", async () => {
    installFakeBinary(`console.error("pulumi: something broke");process.exit(3);`);

    const runner = tc.container.resolve(WebinyCliRunner);
    const result = await runner.execute({ rootPath: tmp, args: ["deploy", "api"] });

    expect(result.isFail()).toBe(true);
    if (result.isFail()) {
      expect(result.error.message).toContain("exited with code 3");
      expect(String(result.error.data?.output)).toContain("pulumi: something broke");
    }
  });

  it("passes only the allow-listed environment to the child", async () => {
    installFakeBinary(
      `console.log(JSON.stringify({secret: process.env.SOME_SECRET ?? null, ci: process.env.CI ?? null, backend: process.env.WEBINY_PULUMI_BACKEND ?? null}));`,
    );

    process.env["SOME_SECRET"] = "leak";
    process.env["WEBINY_PULUMI_BACKEND"] = "s3://server-level";

    try {
      const runner = tc.container.resolve(WebinyCliRunner);
      const result = await runner.execute({ rootPath: tmp, args: ["output", "api"] });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(parseJsonOutput(result.value.stdout)).toEqual({
          secret: null,
          ci: "1",
          backend: null,
        });
      }
    } finally {
      delete process.env["SOME_SECRET"];
      delete process.env["WEBINY_PULUMI_BACKEND"];
    }
  });

  it("kills the child when the signal aborts", async () => {
    installFakeBinary(`setTimeout(() => console.log("should never print"), 60000);`);

    const controller = new AbortController();
    const runner = tc.container.resolve(WebinyCliRunner);
    const promise = runner.execute({
      rootPath: tmp,
      args: ["deploy", "api"],
      signal: controller.signal,
    });

    setTimeout(() => controller.abort(), 50);

    const result = await promise;

    expect(result.isFail()).toBe(true);
    if (result.isFail()) {
      expect(result.error.message).toContain("SIGTERM");
    }
  });

  it("kills the child's whole process group, not only the child", async () => {
    // The webiny binary is a launcher. What holds the stack is pulumi, spawned underneath it, so a
    // cancel that signals only the recorded pid lets the deploy carry on unwatched.
    installFakeBinary(`
      const { spawn } = require("node:child_process");
      const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
      console.log("grandchild " + child.pid);
      setInterval(() => {}, 1000);
    `);

    const controller = new AbortController();
    const runner = tc.container.resolve(WebinyCliRunner);

    let grandchildPid = 0;
    const promise = runner.execute({
      rootPath: tmp,
      args: ["deploy", "api"],
      signal: controller.signal,
      onLine: (line) => {
        if (line.startsWith("grandchild ")) {
          grandchildPid = Number(line.slice("grandchild ".length));
          controller.abort();
        }
      },
    });

    await promise;

    expect(grandchildPid).toBeGreaterThan(0);
    expect(await hasExited(grandchildPid)).toBe(true);
  });

  it("records the child while it runs and forgets it when it exits", async () => {
    installFakeBinary(`console.log("done");`);

    const runner = tc.container.resolve(WebinyCliRunner);
    await runner.execute({ rootPath: tmp, args: ["output", "api"], jobId: "job-1" });

    // Left behind, the row would make the next boot hunt for a process that is long gone.
    expect(tc.databaseClient.db.select().from(childProcesses).all()).toEqual([]);
  });

  it("fails cleanly when the checkout is not a directory", async () => {
    const runner = tc.container.resolve(WebinyCliRunner);
    const result = await runner.execute({ rootPath: path.join(tmp, "missing"), args: ["deploy"] });

    expect(result.isFail()).toBe(true);
  });
});

async function hasExited(pid: number, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}
