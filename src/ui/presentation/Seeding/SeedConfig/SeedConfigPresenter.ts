import { makeAutoObservable, runInAction } from "mobx";
import type { ProjectModel, ProjectTenant } from "~/shared/types.js";
import { LoadSeedConfigUseCase } from "./useCases/LoadSeedConfig/abstractions/LoadSeedConfigUseCase.js";
import { TriggerSeedUseCase } from "./useCases/TriggerSeed/abstractions/TriggerSeedUseCase.js";
import { SeedConfigPresenter as Abstraction } from "./abstractions/SeedConfigPresenter.js";
import type { SeedConfigVM, ModelConfigItem } from "./abstractions/SeedConfigPresenter.js";

interface ModelState {
  model: ProjectModel;
  selected: boolean;
  amount: number;
}

class SeedConfigPresenterImpl implements Abstraction.Interface {
  private _projectId: string | null = null;
  private _projectName: string | null = null;
  private _tenants: ProjectTenant[] = [];
  private _modelStates: ModelState[] = [];
  private _selectedTenant = "";
  private _isLoading = false;
  private _isSeeding = false;
  private _error: string | null = null;
  private _seedResult: { created: number; errors: number } | null = null;

  public constructor(
    private readonly loadSeedConfigUseCase: LoadSeedConfigUseCase.Interface,
    private readonly triggerSeedUseCase: TriggerSeedUseCase.Interface,
  ) {
    makeAutoObservable(this);
  }

  public get vm(): SeedConfigVM {
    return {
      project: this._projectId ? { id: this._projectId, name: this._projectName ?? "" } : null,
      tenants: this._tenants.map((t) => ({
        tenantId: t.tenantId,
        name: t.name,
      })),
      models: this._modelStates.map((ms): ModelConfigItem => ({
        modelId: ms.model.modelId,
        name: ms.model.name,
        selected: ms.selected,
        amount: ms.amount,
      })),
      selectedTenant: this._selectedTenant,
      isLoading: this._isLoading,
      isSeeding: this._isSeeding,
      error: this._error,
      seedResult: this._seedResult,
    };
  }

  public load = async (projectId: string): Promise<void> => {
    this._isLoading = true;
    this._error = null;
    this._seedResult = null;
    this._projectId = projectId;

    try {
      const result = await this.loadSeedConfigUseCase.execute(projectId);

      runInAction(() => {
        if (result.isFail()) {
          this._error = result.error.message;
          return;
        }

        this._tenants = result.value.tenants;
        this._modelStates = result.value.models.map((m) => ({
          model: m,
          selected: true,
          amount: 10,
        }));

        if (this._tenants.length > 0) {
          this._selectedTenant = this._tenants[0]!.tenantId;
        }
      });
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
  };

  public toggleModel = (modelId: string): void => {
    const state = this._modelStates.find((ms) => ms.model.modelId === modelId);
    if (state) {
      state.selected = !state.selected;
    }
  };

  public setAmount = (modelId: string, amount: number): void => {
    const state = this._modelStates.find((ms) => ms.model.modelId === modelId);
    if (state) {
      state.amount = Math.max(1, amount);
    }
  };

  public setTenant = (tenantId: string): void => {
    this._selectedTenant = tenantId;
  };

  public seed = async (): Promise<void> => {
    if (!this._projectId || !this._selectedTenant) {
      return;
    }

    const selectedModels = this._modelStates
      .filter((ms) => ms.selected)
      .map((ms) => ({
        modelId: ms.model.modelId,
        amount: ms.amount,
      }));

    if (selectedModels.length === 0) {
      this._error = "Select at least one model.";
      return;
    }

    this._isSeeding = true;
    this._error = null;
    this._seedResult = null;

    try {
      const result = await this.triggerSeedUseCase.execute({
        projectId: this._projectId,
        tenant: this._selectedTenant,
        models: selectedModels,
      });

      runInAction(() => {
        if (result.isFail()) {
          this._error = result.error.message;
          return;
        }

        const job = result.value;
        this._seedResult = {
          created: job.result?.created ?? 0,
          errors: job.result?.errors.length ?? 0,
        };
      });
    } finally {
      runInAction(() => {
        this._isSeeding = false;
      });
    }
  };
}

export const SeedConfigPresenter = Abstraction.createImplementation({
  implementation: SeedConfigPresenterImpl,
  dependencies: [LoadSeedConfigUseCase, TriggerSeedUseCase],
});
