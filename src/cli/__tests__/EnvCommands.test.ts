import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, afterEach, vi } from "vitest";
import { Result } from "@webiny/stdlib";
import { createCliTestContainer, resolveCommand } from "~/cli/testing/createCliTestContainer.js";
import type { ICliTestContainer } from "~/cli/testing/createCliTestContainer.js";
import { CANCELLED } from "~/cli/testing/StubPrompts.js";
import { InitCommand } from "~/cli/commands/init/abstractions/InitCommand.js";
import { KeyRotationService } from "~/shared/node/encryption/abstractions/KeyRotationService.js";
import { ProjectPersistenceError } from "~/shared/errors.js";

/**
 * Both commands write the `.env` in the current working directory. Every test in this file runs in
 * a temporary one: the file they rewrite is the only file here whose contents are not recoverable.
 */
function useTemporaryCwd(): { path: string; envFile: string; cleanup(): void } {
  const path = mkdtempSync(join(tmpdir(), "cli-env-"));
  const spy = vi.spyOn(process, "cwd").mockReturnValue(path);
  return {
    path,
    envFile: join(path, ".env"),
    cleanup() {
      spy.mockRestore();
      rmSync(path, { recursive: true, force: true });
    },
  };
}

describe("init command", () => {
  let tc: ICliTestContainer;
  let cwd: ReturnType<typeof useTemporaryCwd>;

  afterEach(() => {
    cwd.cleanup();
    tc.cleanup();
  });

  function start(answers: unknown[]): void {
    cwd = useTemporaryCwd();
    tc = createCliTestContainer({ answers });
  }

  it("writes a .env carrying a fresh key and the chosen ports", async () => {
    start(["4100", "4101"]);

    await tc.container.resolve(InitCommand).execute();

    const written = readFileSync(cwd.envFile, "utf-8");
    expect(written).toContain("API_PORT=4100");
    expect(written).toContain("UI_PORT=4101");
    expect(written).toContain("MAX_CONCURRENT_JOBS=4");
    expect(written).toMatch(/^ENCRYPTION_KEY=[0-9a-f]{64}$/m);
  });

  it("generates a different key every time", async () => {
    start(["4000", "4001"]);
    await tc.container.resolve(InitCommand).execute();
    const first = readFileSync(cwd.envFile, "utf-8");

    rmSync(cwd.envFile);
    tc.cleanup();
    tc = createCliTestContainer({ answers: ["4000", "4001"] });
    await tc.container.resolve(InitCommand).execute();
    const second = readFileSync(cwd.envFile, "utf-8");

    expect(first).not.toBe(second);
  });

  it("falls back to the default ports when both are left blank", async () => {
    start(["", ""]);

    await tc.container.resolve(InitCommand).execute();

    const written = readFileSync(cwd.envFile, "utf-8");
    expect(written).toContain("API_PORT=4000");
    expect(written).toContain("UI_PORT=4001");
  });

  it("keeps an existing .env when the overwrite is declined", async () => {
    start([false]);
    writeFileSync(cwd.envFile, "ENCRYPTION_KEY=existing\n");

    await tc.container.resolve(InitCommand).execute();

    expect(readFileSync(cwd.envFile, "utf-8")).toBe("ENCRYPTION_KEY=existing\n");
    expect(tc.ui.on("cancel")).toEqual(["Cancelled — existing .env kept."]);
  });

  it("keeps an existing .env when the overwrite question is cancelled", async () => {
    start([CANCELLED]);
    writeFileSync(cwd.envFile, "ENCRYPTION_KEY=existing\n");

    await tc.container.resolve(InitCommand).execute();

    expect(readFileSync(cwd.envFile, "utf-8")).toBe("ENCRYPTION_KEY=existing\n");
  });

  it("replaces an existing .env when the overwrite is accepted", async () => {
    start([true, "4000", "4001"]);
    writeFileSync(cwd.envFile, "ENCRYPTION_KEY=existing\n");

    await tc.container.resolve(InitCommand).execute();

    expect(readFileSync(cwd.envFile, "utf-8")).not.toContain("existing");
  });

  it("writes nothing when a port question is cancelled", async () => {
    start(["4000", CANCELLED]);

    await tc.container.resolve(InitCommand).execute();

    expect(() => readFileSync(cwd.envFile, "utf-8")).toThrow();
    expect(tc.ui.on("cancel")).toEqual(["Cancelled."]);
  });
});

describe("rotate-key command", () => {
  let tc: ICliTestContainer;
  let cwd: ReturnType<typeof useTemporaryCwd>;
  let rotations: KeyRotationService.Input[];

  const OLD_KEY = "a".repeat(64);
  const NEW_KEY = "b".repeat(64);

  afterEach(() => {
    cwd.cleanup();
    vi.unstubAllEnvs();
    tc.cleanup();
  });

  function start(answers: unknown[], outcome: "ok" | "fail" = "ok"): void {
    cwd = useTemporaryCwd();
    vi.stubEnv("ENCRYPTION_KEY", OLD_KEY);
    tc = createCliTestContainer({ answers });

    rotations = [];
    tc.container.registerInstance(KeyRotationService, {
      execute: async (input) => {
        rotations.push(input);
        return outcome === "ok"
          ? Result.ok({ rotated: 3 })
          : Result.fail(new ProjectPersistenceError(new Error("a token would not decrypt")));
      },
    });
  }

  it("refuses to run before init has written a key", async () => {
    cwd = useTemporaryCwd();
    vi.stubEnv("ENCRYPTION_KEY", "");
    tc = createCliTestContainer({ answers: [] });
    rotations = [];

    await resolveCommand(tc, "rotate-key").execute();

    expect(tc.ui.on("error")).toEqual(["ENCRYPTION_KEY is not set. Run 'yarn cli init' first."]);
  });

  it("re-encrypts with a generated key and writes it back to .env", async () => {
    start([true, true]);
    writeFileSync(cwd.envFile, `ENCRYPTION_KEY=${OLD_KEY}\nAPI_PORT=4000\n`);

    await resolveCommand(tc, "rotate-key").execute();

    expect(rotations).toHaveLength(1);
    expect(rotations[0]!.oldKey).toBe(OLD_KEY);
    expect(rotations[0]!.newKey).toMatch(/^[0-9a-f]{64}$/);
    expect(rotations[0]!.newKey).not.toBe(OLD_KEY);

    const written = readFileSync(cwd.envFile, "utf-8");
    expect(written).toContain(`ENCRYPTION_KEY=${rotations[0]!.newKey}`);
    // The rest of the file survives the rewrite.
    expect(written).toContain("API_PORT=4000");
    expect(tc.ui.on("spinner:stop")).toEqual(["Rotated 3 project(s)."]);
  });

  it("uses a key typed by hand when one is offered", async () => {
    start([false, NEW_KEY, true]);
    writeFileSync(cwd.envFile, `ENCRYPTION_KEY=${OLD_KEY}\n`);

    await resolveCommand(tc, "rotate-key").execute();

    expect(rotations[0]!.newKey).toBe(NEW_KEY);
    expect(readFileSync(cwd.envFile, "utf-8")).toContain(`ENCRYPTION_KEY=${NEW_KEY}`);
  });

  it("requires a typed key to be 64 hex characters", async () => {
    start([false, NEW_KEY, true]);
    writeFileSync(cwd.envFile, `ENCRYPTION_KEY=${OLD_KEY}\n`);

    await resolveCommand(tc, "rotate-key").execute();

    const check = tc.prompts.validators.get("Enter new encryption key (64-character hex string)")!;
    expect(check("")).toBe("Key must be exactly 64 hex characters (32 bytes)");
    expect(check("abc")).toBe("Key must be exactly 64 hex characters (32 bytes)");
    expect(check("z".repeat(64))).toBe("Key must be a hex string");
    expect(check(NEW_KEY)).toBeUndefined();
  });

  it("rotates nothing when the confirmation is declined", async () => {
    start([true, false]);

    await resolveCommand(tc, "rotate-key").execute();

    expect(rotations).toEqual([]);
    expect(tc.ui.on("cancel")).toEqual(["Cancelled."]);
  });

  it("rotates nothing when the first question is cancelled", async () => {
    start([CANCELLED]);

    await resolveCommand(tc, "rotate-key").execute();

    expect(rotations).toEqual([]);
  });

  it("rotates nothing when the typed key is cancelled", async () => {
    start([false, CANCELLED]);

    await resolveCommand(tc, "rotate-key").execute();

    expect(rotations).toEqual([]);
  });

  it("leaves .env alone when the re-encryption fails", async () => {
    start([true, true], "fail");
    writeFileSync(cwd.envFile, `ENCRYPTION_KEY=${OLD_KEY}\n`);

    await resolveCommand(tc, "rotate-key").execute();

    expect(readFileSync(cwd.envFile, "utf-8")).toBe(`ENCRYPTION_KEY=${OLD_KEY}\n`);
    expect(tc.ui.on("error")).toEqual(["Key rotation failed: a token would not decrypt"]);
  });

  it("prints the new key when the tokens rotated but .env could not be written", async () => {
    start([true, true]);
    // No .env to rewrite: the tokens are already re-encrypted, so the key must not be lost.

    await resolveCommand(tc, "rotate-key").execute();

    const warning = tc.ui.on("warn").join("\n");
    expect(warning).toContain("Tokens rotated but .env could not be updated");
    expect(warning).toContain(rotations[0]!.newKey);
  });
});
