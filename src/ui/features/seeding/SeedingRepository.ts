import { makeAutoObservable } from "mobx";
import type { SeedJob } from "~/shared/types.js";
import { SeedingRepository as Abstraction } from "./abstractions/SeedingRepository.js";

class SeedingRepositoryImpl implements Abstraction.Interface {
  private _seedJobs: SeedJob[] = [];

  public constructor() {
    makeAutoObservable(this);
  }

  public get seedJobs(): SeedJob[] {
    return this._seedJobs;
  }

  public setSeedJobs(jobs: SeedJob[]): void {
    this._seedJobs = jobs;
  }

  public addSeedJob(job: SeedJob): void {
    this._seedJobs = [job, ...this._seedJobs];
  }
}

export const SeedingRepository = Abstraction.createImplementation({
  implementation: SeedingRepositoryImpl,
  dependencies: [],
});
