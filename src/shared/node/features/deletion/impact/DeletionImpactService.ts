import { Result } from "@webiny/stdlib";
import { count, eq, inArray } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import {
  jobs,
  projectEnvironments,
  projectFiles,
  projectGroups,
  projectModels,
  projectStacks,
  projectTenants,
  projects,
  seedEntries,
  seedJobs,
  seedTemplates,
  syncLogs,
} from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { DeletionImpactService as Abstraction } from "./abstractions/DeletionImpactService.js";
import {
  EnvironmentNotFoundError,
  ProjectNotFoundError,
  ProjectPersistenceError,
} from "~/shared/errors.js";
import type { DeletionImpact } from "~/shared/types.js";

/**
 * Counts the rows a hard delete would destroy.
 *
 * Every child table cascades from `projects` and from `project_environments`, so these counts are
 * exactly what disappears with the parent. They exist so the confirmation can state the loss in
 * numbers instead of "this cannot be undone".
 */
class DeletionImpactServiceImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<DeletionImpact, Abstraction.Error>> {
    try {
      return input.scope === "project" ? this.forProject(input.id) : this.forEnvironment(input.id);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }

  private forProject(projectId: string): Result<DeletionImpact, Abstraction.Error> {
    const project = this.databaseClient.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!project) {
      return Result.fail(new ProjectNotFoundError(projectId));
    }

    /**
     * `project_stacks` hangs off the environment only, so it is counted through this project's
     * environment ids rather than a `projectId` column it does not have.
     */
    const environmentIds = this.databaseClient.db
      .select({ id: projectEnvironments.id })
      .from(projectEnvironments)
      .where(eq(projectEnvironments.projectId, projectId))
      .all()
      .map((row) => row.id);

    return Result.ok({
      environments: environmentIds.length,
      stacks: this.countIn(projectStacks, projectStacks.environmentId, environmentIds),
      tenants: this.countBy(projectTenants, projectTenants.projectId, projectId),
      groups: this.countBy(projectGroups, projectGroups.projectId, projectId),
      models: this.countBy(projectModels, projectModels.projectId, projectId),
      files: this.countBy(projectFiles, projectFiles.projectId, projectId),
      seedJobs: this.countBy(seedJobs, seedJobs.projectId, projectId),
      seedEntries: this.countBy(seedEntries, seedEntries.projectId, projectId),
      syncLogs: this.countBy(syncLogs, syncLogs.projectId, projectId),
      jobs: this.countBy(jobs, jobs.projectId, projectId),
      seedTemplates: this.countBy(seedTemplates, seedTemplates.projectId, projectId),
    });
  }

  private forEnvironment(environmentId: string): Result<DeletionImpact, Abstraction.Error> {
    const environment = this.databaseClient.db
      .select({ id: projectEnvironments.id })
      .from(projectEnvironments)
      .where(eq(projectEnvironments.id, environmentId))
      .get();

    if (!environment) {
      return Result.fail(new EnvironmentNotFoundError(environmentId));
    }

    /**
     * An environment is not a parent of other environments, and seed templates are project-scoped
     * — both survive it, so both are zero here rather than omitted.
     */
    return Result.ok({
      environments: 0,
      stacks: this.countBy(projectStacks, projectStacks.environmentId, environmentId),
      tenants: this.countBy(projectTenants, projectTenants.environmentId, environmentId),
      groups: this.countBy(projectGroups, projectGroups.environmentId, environmentId),
      models: this.countBy(projectModels, projectModels.environmentId, environmentId),
      files: this.countBy(projectFiles, projectFiles.environmentId, environmentId),
      seedJobs: this.countBy(seedJobs, seedJobs.environmentId, environmentId),
      seedEntries: this.countBy(seedEntries, seedEntries.environmentId, environmentId),
      syncLogs: this.countBy(syncLogs, syncLogs.environmentId, environmentId),
      jobs: this.countBy(jobs, jobs.environmentId, environmentId),
      seedTemplates: 0,
    });
  }

  private countBy(table: SQLiteTable, column: SQLiteColumn, value: string): number {
    const row = this.databaseClient.db
      .select({ value: count() })
      .from(table)
      .where(eq(column, value))
      .get();

    return row?.value ?? 0;
  }

  private countIn(table: SQLiteTable, column: SQLiteColumn, values: string[]): number {
    if (values.length === 0) {
      return 0;
    }

    const row = this.databaseClient.db
      .select({ value: count() })
      .from(table)
      .where(inArray(column, values))
      .get();

    return row?.value ?? 0;
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const DeletionImpactService = Abstraction.createImplementation({
  implementation: DeletionImpactServiceImpl,
  dependencies: [DatabaseClient],
});
