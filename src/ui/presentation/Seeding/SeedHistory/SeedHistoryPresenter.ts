import { makeAutoObservable, runInAction } from "mobx";
import { SeedingRepository } from "~/ui/features/seeding/abstractions/SeedingRepository.js";
import { LoadSeedHistoryUseCase } from "./useCases/LoadSeedHistory/abstractions/LoadSeedHistoryUseCase.js";
import { SeedHistoryPresenter as Abstraction } from "./abstractions/SeedHistoryPresenter.js";
import type { SeedHistoryVM, SeedHistoryJobVM } from "./abstractions/SeedHistoryPresenter.js";
import type { EnvironmentRef } from "~/shared/types.js";

class SeedHistoryPresenterImpl implements Abstraction.Interface {
  private _isLoading = false;
  private _error: string | null = null;

  public constructor(
    private readonly loadSeedHistoryUseCase: LoadSeedHistoryUseCase.Interface,
    private readonly seedingRepository: SeedingRepository.Interface,
  ) {
    makeAutoObservable(this);
  }

  public get vm(): SeedHistoryVM {
    const jobs = this.seedingRepository.seedJobs.map((job): SeedHistoryJobVM => ({
      id: job.id,
      status: job.status,
      modelCount: job.config.models.length,
      created: job.result?.created ?? 0,
      errors: job.result?.errors.length ?? 0,
      createdAt: job.createdAt,
    }));

    return {
      jobs,
      isLoading: this._isLoading,
      error: this._error,
      // An empty history and one that could not be read are different answers.
      isEmpty: !this._isLoading && this._error === null && jobs.length === 0,
    };
  }

  public load = async (ref: EnvironmentRef): Promise<void> => {
    this._isLoading = true;
    this._error = null;
    try {
      const result = await this.loadSeedHistoryUseCase.execute(ref);
      if (result.isFail()) {
        runInAction(() => {
          this._error = result.error.message;
        });
      }
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
  };
}

export const SeedHistoryPresenter = Abstraction.createImplementation({
  implementation: SeedHistoryPresenterImpl,
  dependencies: [LoadSeedHistoryUseCase, SeedingRepository],
});
