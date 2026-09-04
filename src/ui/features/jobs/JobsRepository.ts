import { makeAutoObservable } from "mobx";
import type { Job } from "~/shared/types.js";
import { JobsRepository as Abstraction } from "./abstractions/JobsRepository.js";

class JobsRepositoryImpl implements Abstraction.Interface {
  private _jobs: Job[] = [];

  public constructor() {
    makeAutoObservable(this);
  }

  public get jobs(): Job[] {
    return this._jobs;
  }

  public setJobs(jobs: Job[]): void {
    this._jobs = jobs;
  }
}

export const JobsRepository = Abstraction.createImplementation({
  implementation: JobsRepositoryImpl,
  dependencies: [],
});
