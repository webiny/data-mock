import type { JobExecutor } from "../abstractions/JobExecutor.js";

interface IExecutionContextOverrides {
  jobId?: string;
  projectId?: string | null;
  environmentId?: string | null;
  /** Serialized into `configJson`. Use `configJson` directly to hand an executor malformed JSON. */
  config?: unknown;
  configJson?: string | null;
}

export interface IStubExecutionContext extends JobExecutor.ExecutionContext {
  /** Every line the executor appended, in order. */
  readonly logs: string[];
  readonly progress: Array<{ percent: number; label: string | undefined }>;
  /** What the executor left through `setResult`, or `undefined` when it set none. */
  readonly result: unknown;
  abort(): void;
}

/**
 * The half of `JobExecutionContext` an executor can see, without a database or a socket behind it.
 *
 * Executors are tested against this rather than through the worker: what they own is the guard
 * clauses, the config parsing and the mapping from a service Result to logs and to a thrown error.
 * Running the queue to reach that would prove the queue instead.
 */
export function createExecutionContext(
  overrides: IExecutionContextOverrides = {},
): IStubExecutionContext {
  const controller = new AbortController();
  const logs: string[] = [];
  const progress: Array<{ percent: number; label: string | undefined }> = [];
  let result: unknown = undefined;

  const configJson =
    overrides.configJson !== undefined
      ? overrides.configJson
      : overrides.config === undefined
        ? null
        : JSON.stringify(overrides.config);

  return {
    jobId: overrides.jobId ?? "job-1",
    projectId: overrides.projectId === undefined ? "project-1" : overrides.projectId,
    environmentId: overrides.environmentId === undefined ? "env-1" : overrides.environmentId,
    configJson,
    // Arrow functions: executors pass `context.appendLog` on as a bare callback.
    appendLog: (line: string) => {
      logs.push(line);
    },
    setProgress: (input: JobExecutor.SetProgressInput) => {
      progress.push({ percent: input.percent, label: input.label });
    },
    setResult: (value: unknown) => {
      result = value;
    },
    signal: controller.signal,
    logs,
    progress,
    get result() {
      return result;
    },
    abort() {
      controller.abort();
    },
  };
}
