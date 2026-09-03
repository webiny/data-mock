import type { FastifyReply } from "fastify";
import { sendError } from "./sendError.js";
import type { RouteSend } from "./types.js";

export function createSend(reply: FastifyReply): RouteSend {
  return {
    async list<T>(key: string, items: T[], total: number): Promise<void> {
      await reply.status(200).send({
        [key]: { items, total },
      });
    },

    async one<T>(key: string, value: T): Promise<void> {
      await reply.status(200).send({
        [key]: value,
      });
    },

    async none(): Promise<void> {
      await reply.status(204).send();
    },

    async error(error: unknown): Promise<void> {
      await sendError(reply, error);
    },
  };
}
