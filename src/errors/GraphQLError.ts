import type { GenericRecord } from "~/types.js";

export type GraphQLErrorData = GenericRecord | string | undefined | null;

export class GraphQLError extends Error {
  public readonly code: number;
  public readonly data?: GraphQLErrorData;

  public constructor(message: string, code: number, data?: GraphQLErrorData) {
    super();
    this.message = message;
    this.code = code;
    this.data = data;
  }
}
