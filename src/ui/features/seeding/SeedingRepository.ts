import { makeAutoObservable } from "mobx";
import type { SeedJob } from "~/shared/types.js";
import { SeedingRepository as Abstraction } from "./abstractions/SeedingRepository.js";

class SeedingRepositoryImpl implements Abstraction.Interface {
  private _seedJobs: SeedJob[] = [];
  private _total = 0;

  public constructor() {
    makeAutoObservable(this);
  }

  public get seedJobs(): SeedJob[] {
    return this._seedJobs;
  }

  public get totalSeedJobs(): number {
    return this._total;
  }

  public setSeedJobs(jobs: SeedJob[], total: number): void {
    this._seedJobs = jobs;
    this._total = total;
  }

  public addSeedJob(job: SeedJob): void {
    this._seedJobs = [job, ...this._seedJobs];
  }
}

export const SeedingRepository = Abstraction.createImplementation({
  implementation: SeedingRepositoryImpl,
  dependencies: [],
});
