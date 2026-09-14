/**
 * Environments are addressed in the URL by stack name (`dev`, `dev___blue`), not by id.
 * Generated ids change whenever the database is recreated, which would break every bookmark; a
 * stack name is stable and readable, and is already unique per project.
 */
export const AppRoutes = {
  projectList: () => "/",
  projectDetail: (projectId: string) => `/projects/${projectId}`,

  /** Bare project URL — resolves to the project's first environment. */
  projectTab: (projectId: string, tab: string) => `/projects/${projectId}/${tab}`,

  environment: (projectId: string, envName: string) => `/projects/${projectId}/env/${envName}`,
  environmentTab: (projectId: string, envName: string, tab: string) =>
    `/projects/${projectId}/env/${envName}/${tab}`,

  seedConfig: (projectId: string, envName: string) =>
    `/projects/${projectId}/env/${envName}/seed`,
  seedHistory: (projectId: string, envName: string) =>
    `/projects/${projectId}/env/${envName}/history`,

  fileManager: () => "/files",
} as const;
