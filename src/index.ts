import yargs from "yargs";
import { logger } from "./logger.js";
import { hideBin } from "yargs/helpers";
import { Application, ApplicationParams } from "~/base/Application.js";

const main = async () => {
  const argv = await yargs(hideBin(process.argv)).version(false).argv;
  const app = new Application(argv as unknown as ApplicationParams);
  await app.run();
};

main().catch((ex) => {
  logger.error(ex.message);
  logger.info(ex.data);
  logger.info(ex.stack);
});
