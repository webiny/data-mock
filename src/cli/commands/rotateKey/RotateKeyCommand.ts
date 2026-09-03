import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { isCancel } from "@clack/prompts";
import { UI } from "~/cli/abstractions/UI.js";
import { Prompts } from "~/cli/abstractions/Prompts.js";
import { KeyRotationService } from "~/shared/node/encryption/abstractions/KeyRotationService.js";
import { RotateKeyCommand as Abstraction } from "./abstractions/RotateKeyCommand.js";

const ENV_PATH = join(process.cwd(), ".env");

class RotateKeyCommandImpl implements Abstraction.Interface {
  public readonly name = "rotate-key";
  public readonly description = "Rotate the API token encryption key";

  public constructor(
    private readonly ui: UI.Interface,
    private readonly prompts: Prompts.Interface,
    private readonly keyRotationService: KeyRotationService.Interface,
  ) {}

  public async execute(): Promise<void> {
    this.ui.intro("Rotate Encryption Key");

    const oldKey = process.env.ENCRYPTION_KEY;
    if (!oldKey) {
      this.ui.log.error("ENCRYPTION_KEY is not set. Run 'yarn cli init' first.");
      return;
    }

    const generateNew = await this.prompts.confirm({
      message: "Generate a new random key? (No = enter manually)",
    });

    if (isCancel(generateNew)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    let newKey: string;

    if (generateNew) {
      newKey = randomBytes(32).toString("hex");
    } else {
      const entered = await this.prompts.text({
        message: "Enter new encryption key (64-character hex string)",
        validate: (value) => {
          if (!value || value.length !== 64) {
            return "Key must be exactly 64 hex characters (32 bytes)";
          }
          if (!/^[0-9a-f]+$/i.test(value)) {
            return "Key must be a hex string";
          }
          return undefined;
        },
      });

      if (isCancel(entered)) {
        this.ui.cancel("Cancelled.");
        return;
      }

      newKey = entered as string;
    }

    const confirmed = await this.prompts.confirm({
      message: "This will re-encrypt all stored API tokens. Continue?",
    });

    if (isCancel(confirmed) || !confirmed) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const spinner = this.ui.spinner();
    spinner.start("Rotating encryption key...");

    const result = await this.keyRotationService.execute({
      oldKey,
      newKey,
    });

    if (result.isFail()) {
      spinner.stop("Failed.");
      this.ui.log.error(`Key rotation failed: ${result.error.message}`);
      return;
    }

    try {
      const envContent = readFileSync(ENV_PATH, "utf-8");
      const updatedContent = envContent.replace(/^ENCRYPTION_KEY=.+$/m, `ENCRYPTION_KEY=${newKey}`);
      writeFileSync(ENV_PATH, updatedContent, "utf-8");
    } catch {
      spinner.stop("Warning.");
      this.ui.log.warn(
        `Tokens rotated but .env could not be updated. Manually set ENCRYPTION_KEY=${newKey}`,
      );
      return;
    }

    spinner.stop(`Rotated ${result.value.rotated} project(s).`);
    this.ui.outro("Encryption key rotated successfully.");
  }
}

export const RotateKeyCommand = Abstraction.createImplementation({
  implementation: RotateKeyCommandImpl,
  dependencies: [UI, Prompts, KeyRotationService],
});
