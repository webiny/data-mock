import { makeAutoObservable, runInAction } from "mobx";
import type { ProjectModel, ProjectTenant, PublishStrategy, Revisions } from "~/shared/types.js";
import { LoadSeedConfigUseCase } from "./useCases/LoadSeedConfig/abstractions/LoadSeedConfigUseCase.js";
import { TriggerSeedUseCase } from "./useCases/TriggerSeed/abstractions/TriggerSeedUseCase.js";
import { SeedConfigPresenter as Abstraction } from "./abstractions/SeedConfigPresenter.js";
import type {
  ISeedConfigVM,
  IGroupConfigVM,
  IModelConfigVM,
} from "./abstractions/SeedConfigPresenter.js";

interface ModelState {
  model: ProjectModel;
  selected: boolean;
  amount: number | null;
  revisions: string | null;
  hasOverride: boolean;
}

const SYSTEM_MODEL_PREFIX = "wby";

function parseRevisions(value: string): Revisions {
  const trimmed = value.trim();
  if (trimmed.includes("-")) {
    const [minStr, maxStr] = trimmed.split("-");
    const min = parseInt(minStr!, 10);
    const max = parseInt(maxStr!, 10);
    if (!isNaN(min) && !isNaN(max) && min >= 1 && max >= min) {
      return { min, max };
    }
  }
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1) {
    return num;
  }
  return 1;
}

class SeedConfigPresenterImpl implements Abstraction.Interface {
  private _projectId: string | null = null;
  private _projectName: string | null = null;
  private _tenants: ProjectTenant[] = [];
  private _modelStates: ModelState[] = [];
  private _selectedTenant = "";
  private _globalAmount = 10;
  private _globalRevisions = "1";
  private _publishStrategy: PublishStrategy = "none";
  private _publishPercent = 50;
  private _includeUnpublish = false;
  private _dryRun = false;
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

  public get vm(): ISeedConfigVM {
    const seedableStates = this._modelStates.filter(
      (ms) => !ms.model.modelId.startsWith(SYSTEM_MODEL_PREFIX),
    );

    const groupMap = new Map<string, { slug: string; name: string; models: ModelState[] }>();

    for (const ms of seedableStates) {
      const slug = ms.model.groupSlug;
      const existing = groupMap.get(slug);
      if (existing) {
        existing.models.push(ms);
      } else {
        groupMap.set(slug, { slug, name: slug, models: [ms] });
      }
    }

    const groups: IGroupConfigVM[] = Array.from(groupMap.values()).map((g) => ({
      slug: g.slug,
      name: g.name,
      allSelected: g.models.every((ms) => ms.selected),
      models: g.models.map((ms): IModelConfigVM => ({
        modelId: ms.model.modelId,
        name: ms.model.name,
        groupSlug: ms.model.groupSlug,
        selected: ms.selected,
        plugin: ms.model.plugin,
        amount: ms.hasOverride ? ms.amount : null,
        revisions: ms.hasOverride ? ms.revisions : null,
        hasOverride: ms.hasOverride,
      })),
    }));

    return {
      project: this._projectId ? { id: this._projectId, name: this._projectName ?? "" } : null,
      tenants: this._tenants.map((t) => ({
        tenantId: t.tenantId,
        name: t.name,
      })),
      groups,
      selectedTenant: this._selectedTenant,
      globalAmount: this._globalAmount,
      globalRevisions: this._globalRevisions,
      publishStrategy: this._publishStrategy,
      publishPercent: this._publishPercent,
      includeUnpublish: this._includeUnpublish,
      dryRun: this._dryRun,
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

        this._projectName = result.value.projectName;
        this._tenants = result.value.tenants;
        this._modelStates = result.value.models.map((m) => ({
          model: m,
          selected: !m.modelId.startsWith(SYSTEM_MODEL_PREFIX),
          amount: null,
          revisions: null,
          hasOverride: false,
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

  public toggleGroup = (groupSlug: string): void => {
    const groupModels = this._modelStates.filter((ms) => ms.model.groupSlug === groupSlug);
    const allSelected = groupModels.every((ms) => ms.selected);
    for (const ms of groupModels) {
      ms.selected = !allSelected;
    }
  };

  public selectAll = (): void => {
    for (const ms of this._modelStates) {
      ms.selected = true;
    }
  };

  public deselectAll = (): void => {
    for (const ms of this._modelStates) {
      ms.selected = false;
    }
  };

  public setGlobalAmount = (amount: number): void => {
    this._globalAmount = Math.max(1, amount);
  };

  public setGlobalRevisions = (value: string): void => {
    this._globalRevisions = value;
  };

  public toggleModelOverride = (modelId: string): void => {
    const state = this._modelStates.find((ms) => ms.model.modelId === modelId);
    if (state) {
      state.hasOverride = !state.hasOverride;
      if (state.hasOverride) {
        state.amount = this._globalAmount;
        state.revisions = this._globalRevisions;
      } else {
        state.amount = null;
        state.revisions = null;
      }
    }
  };

  public setAmount = (modelId: string, amount: number): void => {
    const state = this._modelStates.find((ms) => ms.model.modelId === modelId);
    if (state) {
      state.amount = Math.max(1, amount);
    }
  };

  public setRevisions = (modelId: string, value: string): void => {
    const state = this._modelStates.find((ms) => ms.model.modelId === modelId);
    if (state) {
      state.revisions = value;
    }
  };

  public setTenant = (tenantId: string): void => {
    this._selectedTenant = tenantId;
  };

  public setPublishStrategy = (strategy: PublishStrategy): void => {
    this._publishStrategy = strategy;
  };

  public setPublishPercent = (percent: number): void => {
    this._publishPercent = Math.max(0, Math.min(100, percent));
  };

  public setIncludeUnpublish = (value: boolean): void => {
    this._includeUnpublish = value;
  };

  public setDryRun = (value: boolean): void => {
    this._dryRun = value;
  };

  public seed = async (): Promise<void> => {
    if (!this._projectId || !this._selectedTenant) {
      return;
    }

    const selectedModels = this._modelStates
      .filter((ms) => ms.selected)
      .map((ms) => ({
        modelId: ms.model.modelId,
        amount: ms.amount ?? this._globalAmount,
        revisions: parseRevisions(ms.revisions ?? this._globalRevisions),
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
        publishStrategy: this._publishStrategy,
        publishPercent: this._publishPercent,
        includeUnpublish: this._includeUnpublish,
        dryRun: this._dryRun,
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
