/**
 * Webiny names a Pulumi stack `<env>` or `<env>___<variant>`. The separator is "___" in both v5
 * (@webiny/cli-plugin-deploy-pulumi/utils/constants.js) and v6
 * (@webiny/project/utils/constants.ts), so one helper serves both.
 *
 * This is also the URL identity of an environment. Generated ids would break every bookmark when
 * the database is recreated; a stack name is stable, readable, and already unique per project via
 * the (project_id, env, variant) index.
 */
export const VARIANT_SEPARATOR = "___";

export interface IStackNameParts {
  env: string;
  /** "" rather than undefined — SQLite treats NULLs as distinct in unique indexes. */
  variant: string;
}

export function getStackName({ env, variant }: IStackNameParts): string {
  return variant === "" ? env : `${env}${VARIANT_SEPARATOR}${variant}`;
}

export function splitStackName(stackName: string): IStackNameParts {
  const index = stackName.indexOf(VARIANT_SEPARATOR);

  if (index === -1) {
    return { env: stackName, variant: "" };
  }

  return {
    env: stackName.slice(0, index),
    variant: stackName.slice(index + VARIANT_SEPARATOR.length),
  };
}
