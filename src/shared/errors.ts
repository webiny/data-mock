import { BaseError } from "@webiny/stdlib";

export class ProjectNotFoundError extends BaseError {
  override readonly code = "Project/NotFound" as const;
  public readonly statusCode = 404;

  public constructor(id: string) {
    super({ message: `Project "${id}" not found` });
  }
}

export class EnvironmentNotFoundError extends BaseError {
  override readonly code = "Environment/NotFound" as const;
  public readonly statusCode = 404;

  public constructor(id: string) {
    super({ message: `Environment "${id}" not found` });
  }
}

/**
 * Raised when an environment exists but cannot be talked to — its `api` app is not deployed, so it
 * has no `apiUrl`. This is a real state, not a corrupt one: an environment with only `core`
 * deployed is "partially deployed" and cannot be seeded until the api app is deployed too.
 */
export class EnvironmentNotConnectedError extends BaseError {
  override readonly code = "Environment/NotConnected" as const;
  public readonly statusCode = 409;

  public constructor(env: string, reason: string) {
    super({ message: `Environment "${env}" is not connectable: ${reason}` });
  }
}

export class ScanRootNotFoundError extends BaseError {
  override readonly code = "ScanRoot/NotFound" as const;
  public readonly statusCode = 404;

  public constructor(id: string) {
    super({ message: `Scan root "${id}" not found` });
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

/**
 * A `webiny` child process that exited non-zero, or could not be started at all. Carries the tail
 * of its output: the failing lines are what make a pulumi failure diagnosable, and the full log is
 * already on the job.
 */
export class WebinyCliError extends BaseError<{ exitCode: number; output: string }> {
  override readonly code = "WebinyCli/CommandFailed" as const;
  public readonly statusCode = 500;

  public constructor(message: string, exitCode: number, output: string) {
    super({ message, data: { exitCode, output } });
  }
}

export class JobNotFoundError extends BaseError {
  override readonly code = "Job/NotFound" as const;
  public readonly statusCode = 404;

  public constructor(id: string) {
    super({ message: `Job "${id}" not found` });
  }
}
