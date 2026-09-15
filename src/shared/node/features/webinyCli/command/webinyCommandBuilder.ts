import { ValidationError } from "~/shared/errors.js";
import { Result } from "@webiny/stdlib";

/**
 * Builds the argv for one `webiny` invocation, per major version.
 *
 * The two majors agree on the shape `webiny <cmd> <app> --env=<env> [--variant] [--region]` and on
 * having no interactive prompts in deploy or destroy. They disagree on almost everything else:
 * v5's `--env` is required where v6 defaults it to "dev", the debug flags differ, and the whole
 * destroy confirmation surface is different.
 */

export type WebinyCommand = "deploy" | "destroy" | "output";

export interface IBuildCommandInput {
  command: WebinyCommand;
  /** 5 or 6. */
  versionMajor: number;
  /** REQUIRED. Never omit it — see the note below. */
  app: string;
  env: string;
  /** "" means no variant. */
  variant?: string | undefined;
  region?: string | null | undefined;
  /**
   * Deploy only. Pulumi plans the change and creates nothing. Declared on both majors with the
   * same name and the same `false` default.
   */
  preview?: boolean | undefined;
}

/** Webiny rejects these three variant names outright (`isValidVariantName`). */
const RESERVED_VARIANTS = new Set(["none", "empty", "blank"]);

/**
 * Deploy order. The tool owns it: api needs core's tables and bucket, admin needs api's URL.
 * Destroy is the reverse.
 */
export const DEPLOY_ORDER = ["core", "api", "admin", "website"];

export function orderAppsForDeploy(apps: string[]): string[] {
  return [...apps].sort((a, b) => rank(a) - rank(b));
}

export function orderAppsForDestroy(apps: string[]): string[] {
  return orderAppsForDeploy(apps).reverse();
}

function rank(app: string): number {
  const index = DEPLOY_ORDER.indexOf(app);
  // Anything the tool does not know about (blueGreen, sync) goes last rather than first: it is
  // never a dependency of core.
  return index === -1 ? DEPLOY_ORDER.length : index;
}

/**
 * The app positional is never optional, on either major.
 *
 * On v5, omitting it trips the `!folder` gate that then demands `--confirm-destroy-env`. On v6 it
 * is worse: `DestroyCommand` destroys admin, api and core in sequence with no confirmation of any
 * kind. Always passing one app is what keeps a destroy scoped to what the user actually confirmed.
 */
export function buildWebinyCommand(input: IBuildCommandInput): Result<string[], ValidationError> {
  if (input.versionMajor !== 5 && input.versionMajor !== 6) {
    return Result.fail(
      new ValidationError(`Unsupported Webiny major version "${input.versionMajor}"`),
    );
  }

  if (input.app.trim() === "") {
    return Result.fail(new ValidationError("An app is required; never run webiny without one"));
  }

  if (input.env.trim() === "") {
    return Result.fail(new ValidationError("An environment is required"));
  }

  const variant = input.variant ?? "";
  if (variant !== "" && RESERVED_VARIANTS.has(variant.toLowerCase())) {
    return Result.fail(new ValidationError(`Variant cannot be named "${variant}"`));
  }

  const args = [input.command, input.app, `--env=${input.env}`];

  if (variant !== "") {
    args.push(`--variant=${variant}`);
  }

  if (input.region) {
    args.push(`--region=${input.region}`);
  }

  if (input.command === "output") {
    // Without --json the null path prints the prose "No output values found." on v6 and nothing
    // parseable on v5, so there is no JSON for the parser to find. Every other rule about reading
    // that output depends on this flag.
    args.push("--json");
    return Result.ok(args);
  }

  /**
   * Deploy-only flags. Verified against both checkouts: v5's `destroy` declares only
   * folder/region/env/variant/confirm-destroy-*, and v6's declares only the three base options —
   * neither accepts `--build` or a deployment-logs flag, so passing one to destroy is at best
   * ignored and at worst rejected.
   *
   * The deployment-logs flag itself differs by major. On v6 `CI=1` already forces those logs on,
   * so it is redundant there but harmless; on v5 it is the only way to get them.
   */
  if (input.command === "deploy") {
    args.push("--build");
    args.push(input.versionMajor === 5 ? "--deployment-logs" : "--show-deployment-logs");

    // `--build` stays on for a preview: pulumi plans against the built app code, so skipping the
    // build would preview a stack shaped by whatever happens to be in the workspace.
    if (input.preview === true) {
      args.push("--preview");
    }
  }

  return Result.ok(args);
}
