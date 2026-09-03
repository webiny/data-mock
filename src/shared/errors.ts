import { BaseError } from "@webiny/stdlib";

export class ProjectNotFoundError extends BaseError {
  override readonly code = "Project/NotFound" as const;
  public readonly statusCode = 404;

  public constructor(id: string) {
    super({ message: `Project "${id}" not found` });
  }
}

export class ProjectPersistenceError extends BaseError<{ error: Error }> {
  override readonly code = "Project/PersistenceError" as const;
  public readonly statusCode = 500;

  public constructor(error: Error) {
    super({ message: error.message, data: { error } });
  }
}

export class SyncLogPersistenceError extends BaseError<{ error: Error }> {
  override readonly code = "SyncLog/PersistenceError" as const;
  public readonly statusCode = 500;

  public constructor(error: Error) {
    super({ message: error.message, data: { error } });
  }
}

export class SeedingError extends BaseError<{ error: Error }> {
  override readonly code = "Seeding/Failed" as const;
  public readonly statusCode = 500;

  public constructor(error: Error) {
    super({ message: error.message, data: { error } });
  }
}

export class GraphQLRequestError extends BaseError<{
  statusCode: number;
  data?: unknown;
}> {
  override readonly code = "GraphQL/RequestError" as const;
  public readonly statusCode: number;

  public constructor(message: string, statusCode: number, data?: unknown) {
    super({ message, data: { statusCode, data } });
    this.statusCode = statusCode || 500;
  }
}

export class ValidationError extends BaseError {
  override readonly code = "Validation/Error" as const;
  public readonly statusCode = 400;

  public constructor(message: string) {
    super({ message });
  }
}
