import { makeAutoObservable } from "mobx";
import type { Job } from "~/shared/types.js";
import { JobsRepository as Abstraction } from "./abstractions/JobsRepository.js";

class JobsRepositoryImpl implements Abstraction.Interface {
  private _jobs: Job[] = [];
  private _total = 0;

  public constructor() {
    makeAutoObservable(this);
  }

  public get jobs(): Job[] {
    return this._jobs;
  }

  public get totalJobs(): number {
    return this._total;
  }

  public setJobs(jobs: Job[], total: number): void {
    this._jobs = jobs;
    this._total = total;
  }
}

export const JobsRepository = Abstraction.createImplementation({
  implementation: JobsRepositoryImpl,
  dependencies: [],
});
