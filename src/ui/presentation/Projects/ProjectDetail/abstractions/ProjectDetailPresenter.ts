import { createAbstraction } from "@webiny/stdlib";
import type { SeedTemplateConfig } from "~/shared/types.js";

export interface IProjectDetailVM {
  project: {
    id: string;
    name: string;
    apiUrl: string;
    webinyVersion: string;
    tenant: string;
    createdAt: number;
  } | null;
  tenants: Array<{ tenantId: string; name: string; discoveredAt: number }>;
  groups: Array<{ slug: string; name: string; modelCount: number }>;
  models: Array<{
    modelId: string;
    name: string;
    groupSlug: string;
    fieldCount: number;
    syncedAt: number | null;
  }>;
  seedJobs: Array<{
    id: string;
    status: string;
    modelCount: number;
    entriesCreated: number;
    errorCount: number;
    createdAt: number;
  }>;
  templates: Array<{
    id: string;
    name: string;
    config: SeedTemplateConfig;
  }>;
  isLoading: boolean;
  activeTab: string;
  isSyncing: boolean;
}

export interface IProjectDetailPresenter {
  readonly vm: IProjectDetailVM;
  load(projectId: string): Promise<void>;
  setTab(tab: string): void;
  syncAll(): Promise<void>;
  seedProject(): void;
  loadTemplate(templateId: string): void;
  deleteTemplate(templateId: string): Promise<void>;
}

export const ProjectDetailPresenter = createAbstraction<IProjectDetailPresenter>(
  "Ui/ProjectDetailPresenter",
);

export namespace ProjectDetailPresenter {
  export type Interface = IProjectDetailPresenter;
  export type VM = IProjectDetailVM;
}
