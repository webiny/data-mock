export const AppRoutes = {
  projectList: () => "/",
  projectDetail: (projectId: string) => `/projects/${projectId}`,
  seedConfig: (projectId: string) => `/projects/${projectId}/seed`,
  seedHistory: (projectId: string) => `/projects/${projectId}/history`,
} as const;
