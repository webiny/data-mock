import { createAbstraction } from "@webiny/stdlib";

export interface ISetProgressInput {
  percent: number;
  label?: string;
}

export interface IJobExecutionContext {
  jobId: string;
  projectId: string | null;
  environmentId: string | null;
  configJson: string | null;
  appendLog: (line: string) => void;
  setProgress: (input: ISetProgressInput) => void;
  /**
   * The job's answer, for a job that has one. Stored as JSON on the row when the job finishes, so
   * a caller that was not listening while it ran can still read it.
   */
  setResult: (value: unknown) => void;
  signal: AbortSignal;
}

export interface IJobExecutor {
  readonly type: string;
  execute(context: IJobExecutionContext): Promise<void>;
}

export const JobExecutor = createAbstraction<IJobExecutor>("Jobs/JobExecutor");

export namespace JobExecutor {
  export type Interface = IJobExecutor;
  export type ExecutionContext = IJobExecutionContext;
  export type SetProgressInput = ISetProgressInput;
}
