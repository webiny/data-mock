import type { FastifyReply } from "fastify";
import { BaseError } from "@webiny/stdlib";

export async function sendError(reply: FastifyReply, error: unknown): Promise<void> {
  if (error instanceof BaseError) {
    const statusCode =
      "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;

    await reply.status(statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        data: error.data ?? null,
      },
    });
    return;
  }

  if (error instanceof Error) {
    await reply.status(500).send({
      error: {
        code: "Unknown",
        message: error.message,
      },
    });
    return;
  }

  await reply.status(500).send({
    error: {
      code: "Unknown",
      message: "An unexpected error occurred.",
    },
  });
}
