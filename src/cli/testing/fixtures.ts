import { projectModels, projectTenants } from "~/shared/node/db/schema.js";
import type { ITestProject } from "~/shared/node/testing/createTestProject.js";
import type { ICliTestContainer } from "./createCliTestContainer.js";

/**
 * Rows a command reads but does not create. Written straight to the tables rather than through a
 * sync, so a command test needs no live CMS to have something to choose from.
 */
export function insertTenant(
  tc: ICliTestContainer,
  project: ITestProject,
  tenantId: string,
  name: string,
): void {
  tc.databaseClient.db
    .insert(projectTenants)
    .values({
      id: `tenant-${tenantId}`,
      projectId: project.projectId,
      environmentId: project.environmentId,
      tenantId,
      name,
      discoveredAt: Date.now(),
    })
    .run();
}

export function insertModel(
  tc: ICliTestContainer,
  project: ITestProject,
  modelId: string,
  name: string,
): void {
  const now = Date.now();
  tc.databaseClient.db
    .insert(projectModels)
    .values({
      id: `model-${modelId}`,
      projectId: project.projectId,
      environmentId: project.environmentId,
      groupSlug: "content",
      modelId,
      name,
      singularApiName: name,
      pluralApiName: `${name}s`,
      description: null,
      fields: "[]",
      plugin: 0,
      remoteId: null,
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

/**
 * Removes the default tenant `createTestProject` stores, for the tests about a project where
 * nothing has been discovered yet.
 */
export function clearTenants(tc: ICliTestContainer): void {
  tc.databaseClient.db.delete(projectTenants).run();
}
