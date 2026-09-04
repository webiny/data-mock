import { createAbstraction } from "@webiny/stdlib";
import type { ISetProgressInput } from "./JobExecutor.js";

export interface IJobExecutionContext {
  appendLog: (line: string) => void;
  setProgress: (input: ISetProgressInput) => void;
  getLogs(): string;
  wasProgressUsed(): boolean;
  dispose(): void;
}

export interface IJobExecutionContextFactoryInput {
  jobId: string;
  projectId: string | null;
}

export interface IJobExecutionContextFactory {
  create(input: IJobExecutionContextFactoryInput): IJobExecutionContext;
}

export const JobExecutionContextFactory = createAbstraction<IJobExecutionContextFactory>(
  "Jobs/JobExecutionContextFactory",
);

export namespace JobExecutionContextFactory {
  export type Interface = IJobExecutionContextFactory;
  export type Input = IJobExecutionContextFactoryInput;
  export type Context = IJobExecutionContext;
}
