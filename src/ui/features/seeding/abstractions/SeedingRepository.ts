import { createAbstraction } from "@webiny/stdlib";
import type { SeedJob } from "~/shared/types.js";

export interface ISeedingRepository {
  readonly seedJobs: SeedJob[];
  readonly totalSeedJobs: number;
  setSeedJobs(jobs: SeedJob[], total: number): void;
  addSeedJob(job: SeedJob): void;
}

export const SeedingRepository = createAbstraction<ISeedingRepository>("Ui/SeedingRepository");

export namespace SeedingRepository {
  export type Interface = ISeedingRepository;
}
