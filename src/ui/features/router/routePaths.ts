export const AppRoutes = {
  projectList: () => "/",
  projectDetail: (projectId: string) => `/projects/${projectId}`,
  projectTab: (projectId: string, tab: string) => `/projects/${projectId}/${tab}`,
  seedConfig: (projectId: string) => `/projects/${projectId}/seed`,
  seedHistory: (projectId: string) => `/projects/${projectId}/history`,
} as const;
