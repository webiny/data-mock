import pino from "pino";
import pinoPretty from "pino-pretty";

const logger = pino(
  {
    level: "trace",
  },
  pinoPretty({
    ignore: "pid,hostname",
  }),
);

export { logger };
