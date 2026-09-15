import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type {
  EnvironmentNotFoundError,
  ProjectNotFoundError,
  ProjectPersistenceError,
  ValidationError,
  WebinyCliError,
} from "~/shared/errors.js";

export interface IWebinyDeploymentInput {
  command: "deploy" | "destroy";
  projectId: string;
  environmentId: string;
  /** Apps to act on. Empty means every deployable app for the project's version. */
  apps?: string[] | undefined;
  /** Overrides the environment's stored region for this run. */
  region?: string | null | undefined;
  /** Deploy only: plan the change and create nothing. */
  preview?: boolean | undefined;
  onLine?: ((line: string) => void) | undefined;
  signal?: AbortSignal | undefined;
  /** The job this run belongs to. Recorded alongside the child process, for diagnostics. */
  jobId?: string | null | undefined;
}

export interface IWebinyDeploymentOutput {
  /** Apps that completed, in the order they ran. */
  apps: string[];
  /** True when nothing was actually changed. */
  preview: boolean;
  /** True when the stack state on disk was re-read afterwards. */
  refreshed: boolean;
}

export interface IWebinyDeploymentService {
  execute(
    input: WebinyDeploymentService.Input,
  ): Promise<Result<IWebinyDeploymentOutput, WebinyDeploymentService.Error>>;
}

export const WebinyDeploymentService = createAbstraction<IWebinyDeploymentService>(
  "WebinyCli/WebinyDeploymentService",
);

export namespace WebinyDeploymentService {
  export type Interface = IWebinyDeploymentService;
  export type Input = IWebinyDeploymentInput;
  export type Output = IWebinyDeploymentOutput;
  export type Error =
    | ProjectNotFoundError
    | EnvironmentNotFoundError
    | ProjectPersistenceError
    | ValidationError
    | WebinyCliError;
}
