import "dotenv/config";
import { Container } from "@webiny/di";
import * as clack from "@clack/prompts";
import { AppFeature } from "~/shared/node/feature.js";
import { CliFeature } from "./feature.js";
import { Command } from "./abstractions/Command.js";
import { InitCommand } from "./commands/init/abstractions/InitCommand.js";

async function main(): Promise<void> {
  const container = new Container();
  AppFeature.register(container);
  CliFeature.register(container);

  const commandName = process.argv[2];

  if (commandName === "init") {
    const initCommand = container.resolve(InitCommand);
    await initCommand.execute();
    return;
  }

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
  } catch (err) {
    clack.log.error(`Failed to load commands: ${err instanceof Error ? err.message : String(err)}`);
    clack.log.info("Run 'yarn cli init' to set up the project first.");
  }
  return commands;
}

function printHelp(commands: Map<string, Command.Interface>): void {
  clack.intro("webiny-mock-data");

  if (commands.size === 0) {
    clack.log.warn("No commands available. Run 'yarn cli init' first.");
    return;
  }

  const lines: string[] = [];
  lines.push(`  ${"init".padEnd(20)} Initialize project configuration (.env file)`);
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
