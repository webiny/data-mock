import { Result, generateId } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { ProjectNotFoundError, ProjectPersistenceError, ValidationError } from "./errors.js";
import { projects } from "~/db/schema.js";
import { DatabaseClient } from "~/db/abstractions/DatabaseClient.js";
import { createProjectBodySchema } from "./responses/projects.js";
import type { Project } from "./types.js";
import { ProjectRepository as Abstraction } from "./abstractions/ProjectRepository.js";

class ProjectRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async list(): Promise<Result<Project[], ProjectPersistenceError>> {
    try {
      const rows = this.databaseClient.db.select().from(projects).all();
      return Result.ok(rows.map(mapRow));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }

  public async getById(
    id: string,
  ): Promise<Result<Project, ProjectNotFoundError | ProjectPersistenceError>> {
    try {
      const row = this.databaseClient.db.select().from(projects).where(eq(projects.id, id)).get();

      if (!row) {
        return Result.fail(new ProjectNotFoundError(id));
      }

      return Result.ok(mapRow(row));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }

  public async create(
    input: Abstraction.CreateInput,
  ): Promise<Result<Project, ValidationError | ProjectPersistenceError>> {
    const parsed = createProjectBodySchema.safeParse(input);
    if (!parsed.success) {
      return Result.fail(new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input"));
    }

    try {
      const now = Date.now();
      const id = generateId();

      const row = {
        id,
        name: parsed.data.name,
        apiUrl: parsed.data.apiUrl,
        apiToken: parsed.data.apiToken,
        tenant: parsed.data.tenant,
        createdAt: now,
        updatedAt: now,
      };

      this.databaseClient.db.insert(projects).values(row).run();

      return Result.ok(mapRow(row));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }

  public async remove(
    id: string,
  ): Promise<Result<void, ProjectNotFoundError | ProjectPersistenceError>> {
    try {
      const existing = this.databaseClient.db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, id))
        .get();

      if (!existing) {
        return Result.fail(new ProjectNotFoundError(id));
      }

      this.databaseClient.db.delete(projects).where(eq(projects.id, id)).run();

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function mapRow(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id,
    name: row.name,
    apiUrl: row.apiUrl,
    apiToken: row.apiToken,
    tenant: row.tenant,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const ProjectRepository = Abstraction.createImplementation({
  implementation: ProjectRepositoryImpl,
  dependencies: [DatabaseClient],
});
