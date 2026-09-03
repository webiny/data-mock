import { makeAutoObservable, runInAction } from "mobx";
import { SeedingRepository } from "~/ui/features/seeding/abstractions/SeedingRepository.js";
import { LoadSeedHistoryUseCase } from "./useCases/LoadSeedHistory/abstractions/LoadSeedHistoryUseCase.js";
import { SeedHistoryPresenter as Abstraction } from "./abstractions/SeedHistoryPresenter.js";
import type { SeedHistoryVM, SeedHistoryJobVM } from "./abstractions/SeedHistoryPresenter.js";

class SeedHistoryPresenterImpl implements Abstraction.Interface {
  private _isLoading = false;

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
      isEmpty: !this._isLoading && jobs.length === 0,
    };
  }

  public load = async (projectId: string): Promise<void> => {
    this._isLoading = true;
    try {
      await this.loadSeedHistoryUseCase.execute(projectId);
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
