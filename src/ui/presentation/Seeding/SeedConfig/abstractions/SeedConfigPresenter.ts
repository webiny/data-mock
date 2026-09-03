import { createAbstraction } from "@webiny/stdlib";

export interface ModelConfigItem {
  modelId: string;
  name: string;
  selected: boolean;
  amount: number;
}

export interface SeedConfigVM {
  project: { id: string; name: string } | null;
  tenants: Array<{ tenantId: string; name: string }>;
  models: ModelConfigItem[];
  selectedTenant: string;
  isLoading: boolean;
  isSeeding: boolean;
  error: string | null;
  seedResult: { created: number; errors: number } | null;
}

export interface ISeedConfigPresenter {
  readonly vm: SeedConfigVM;
  load(projectId: string): Promise<void>;
  toggleModel(modelId: string): void;
  setAmount(modelId: string, amount: number): void;
  setTenant(tenantId: string): void;
  seed(): Promise<void>;
}

export const SeedConfigPresenter =
  createAbstraction<ISeedConfigPresenter>("Ui/SeedConfigPresenter");

export namespace SeedConfigPresenter {
  export type Interface = ISeedConfigPresenter;
  export type VM = SeedConfigVM;
  export type ModelItem = ModelConfigItem;
}
