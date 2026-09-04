import { createAbstraction } from "@webiny/stdlib";
import type { PublishStrategy } from "~/shared/types.js";

export interface IModelConfigVM {
  modelId: string;
  name: string;
  groupSlug: string;
  selected: boolean;
  plugin: boolean;
  amount: number | null;
  revisions: string | null;
  hasOverride: boolean;
}

export interface IGroupConfigVM {
  slug: string;
  name: string;
  allSelected: boolean;
  models: IModelConfigVM[];
}

export interface ITenantVM {
  tenantId: string;
  name: string;
}

export interface ISeedConfigVM {
  project: { id: string; name: string } | null;
  tenants: ITenantVM[];
  groups: IGroupConfigVM[];
  selectedTenant: string;
  globalAmount: number;
  globalRevisions: string;
  publishStrategy: PublishStrategy;
  publishPercent: number;
  includeUnpublish: boolean;
  dryRun: boolean;
  batchSize: number;
  isLoading: boolean;
  isSeeding: boolean;
  showSeedConfirm: boolean;
  error: string | null;
  seedJobStarted: boolean;
}

export interface ISeedConfigPresenter {
  readonly vm: ISeedConfigVM;
  load(projectId: string): Promise<void>;
  toggleModel(modelId: string): void;
  toggleGroup(groupSlug: string): void;
  selectAll(): void;
  deselectAll(): void;
  setGlobalAmount(amount: number): void;
  setGlobalRevisions(value: string): void;
  toggleModelOverride(modelId: string): void;
  setAmount(modelId: string, amount: number): void;
  setRevisions(modelId: string, value: string): void;
  setTenant(tenantId: string): void;
  setPublishStrategy(strategy: PublishStrategy): void;
  setPublishPercent(percent: number): void;
  setIncludeUnpublish(value: boolean): void;
  setDryRun(value: boolean): void;
  setBatchSize(value: number): void;
  requestSeed(): void;
  confirmSeed(): Promise<void>;
  cancelSeed(): void;
}

export const SeedConfigPresenter =
  createAbstraction<ISeedConfigPresenter>("Ui/SeedConfigPresenter");

export namespace SeedConfigPresenter {
  export type Interface = ISeedConfigPresenter;
  export type VM = ISeedConfigVM;
  export type ModelItem = IModelConfigVM;
}
