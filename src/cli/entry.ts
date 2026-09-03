import { Container } from "@webiny/di";
import * as clack from "@clack/prompts";
import { AppFeature } from "~/shared/node/feature.js";
import { CliFeature } from "./feature.js";
import { Command } from "./abstractions/Command.js";

async function main(): Promise<void> {
  const container = new Container();
  AppFeature.register(container);
  CliFeature.register(container);

  const commandName = process.argv[2];
  const commands = resolveCommands(container);

  if (!commandName || commandName === "help" || commandName === "--help") {
    printHelp(commands);
    return;
  }

  const command = commands.get(commandName);
  if (!command) {
    clack.log.error(`Unknown command: ${commandName}`);
    printHelp(commands);
    process.exitCode = 1;
    return;
  }

  await command.execute();
}

function resolveCommands(container: Container): Map<string, Command.Interface> {
  const commands = new Map<string, Command.Interface>();
  try {
    const all = container.resolveAll(Command);
    for (const cmd of all) {
      commands.set(cmd.name, cmd);
    }
  } catch {
    // No commands registered yet
  }
  return commands;
}

function printHelp(commands: Map<string, Command.Interface>): void {
  clack.intro("webiny-mock-data");

  if (commands.size === 0) {
    clack.log.warn("No commands registered yet.");
    clack.outro("Run 'yarn cli help' for more info.");
    return;
  }

  const lines: string[] = [];
  for (const [name, cmd] of commands) {
    lines.push(`  ${name.padEnd(20)} ${cmd.description}`);
  }
  clack.note(lines.join("\n"), "Available commands");
  clack.outro("Usage: yarn cli <command>");
}

main().catch((err: unknown) => {
  clack.log.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
