export interface Project {
  id: string;
  name: string;
  apiUrl: string;
  apiToken: string;
  tenant: string;
  createdAt: number;
  updatedAt: number;
}

export interface SeedJobConfig {
  models: Array<{ modelId: string; amount: number }>;
}

export type SeedJobStatus = "pending" | "running" | "completed" | "failed";

export interface SeedJob {
  id: string;
  projectId: string;
  status: SeedJobStatus;
  config: SeedJobConfig;
  result: SeedJobResult | null;
  startedAt: number | null;
  finishedAt: number | null;
  createdAt: number;
}

export interface SeedJobResult {
  created: number;
  errors: Array<{ message: string; code: string }>;
}
