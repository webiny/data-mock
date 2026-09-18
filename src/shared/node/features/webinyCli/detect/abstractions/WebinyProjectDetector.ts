import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { VersionSource } from "~/shared/types.js";
import type { ValidationError } from "~/shared/errors.js";

export interface IDetectInput {
  /** Absolute path to a candidate Webiny checkout. */
  rootPath: string;
}

export interface IDetectOutput {
  isWebinyProject: boolean;
  /** 5 or 6, or null when the path is not a Webiny project. */
  versionMajor: number | null;
  /** Detected version. Null for a framework workspace root built from source. */
  webinyVersion: string | null;
  versionSource: VersionSource | null;
  /** Apps that can be deployed for this version. */
  apps: string[];
  /** Backend URL from the project's own env files, or null for the default local backend. */
  pulumiBackend: string | null;
  /** True when the backend is a bucket, so checkpoints are not on disk. */
  remoteBackend: boolean;
}

export interface IWebinyProjectDetector {
  execute(input: WebinyProjectDetector.Input): Promise<Result<IDetectOutput, ValidationError>>;
}

export const WebinyProjectDetector = createAbstraction<IWebinyProjectDetector>(
  "WebinyCli/WebinyProjectDetector",
);

export namespace WebinyProjectDetector {
  export type Interface = IWebinyProjectDetector;
  export type Input = IDetectInput;
  export type Output = IDetectOutput;
}
