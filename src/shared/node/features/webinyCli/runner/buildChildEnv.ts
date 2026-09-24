/**
 * Both Webiny majors load the project's `.env` WITHOUT override, so anything already in this
 * server's environment beats the project's own. One server-level `PULUMI_CONFIG_PASSPHRASE` would
 * silently win over every project's `.env`. The child therefore gets an allow-list, not this
 * process's environment with a few names removed.
 */

/**
 * `AWS_*` is kept as a prefix rather than a list of names. An allow-list of named credential vars
 * is not maintainable: beyond key/secret/session-token there are `AWS_DEFAULT_REGION` (often the
 * only region var set), the OIDC/IRSA trio (`AWS_ROLE_ARN`, `AWS_WEB_IDENTITY_TOKEN_FILE`,
 * `AWS_ROLE_SESSION_NAME`), the container-credentials vars, `AWS_SDK_LOAD_CONFIG`,
 * `AWS_CONFIG_FILE`, `AWS_SHARED_CREDENTIALS_FILE`, `AWS_CA_BUNDLE`, `AWS_ENDPOINT_URL` and more.
 * Dropping any one of them fails deploys with "unable to locate credentials" for anyone not on a
 * named profile.
 */
const AWS_PREFIX = "AWS_";

/** The two AWS names the tool sets itself, per project. Inheriting them would override that. */
const AWS_OVERRIDDEN = new Set(["AWS_PROFILE", "AWS_REGION"]);

/**
 * `NODE_*` is not a glob. `NODE_EXTRA_CA_CERTS` is kept by name; `NODE_ENV` and `NODE_OPTIONS` are
 * not — they would leak from this server into a child running webpack, esbuild, vite and pulumi's
 * node runtime, silently changing or breaking every build.
 */
const KEPT = new Set([
  "PATH",
  // Mandatory, not optional: pulumi's `ensureAwsPluginIsInstalled` shells out to `yarn info`, and
  // every one of these monorepos declares `packageManager: yarn@4.x`, so corepack needs HOME.
  "HOME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "TMPDIR",
  "NODE_EXTRA_CA_CERTS",
  "SSL_CERT_FILE",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
]);

export interface IBuildChildEnvInput {
  /** Usually `process.env`. */
  parentEnv: NodeJS.ProcessEnv;
  awsProfile?: string | null | undefined;
  awsRegion?: string | null | undefined;
}

/**
 * `CI=1` is load-bearing on v6, not cosmetic: it skips the OSS telemetry gate that otherwise
 * hard-fails deploys, forces plain-text log formatting, and gates the first-deploy browser open.
 * It also forces deployment logs on, so the raw Pulumi stream always arrives.
 *
 * Stripping `PULUMI_CONFIG_PASSPHRASE` degrades rather than fails — Webiny falls back to the
 * literal "webiny" — which is the point. A project whose real passphrase lives only in the shell
 * and not in its `.env` will fail to decrypt its stack, and that is reported as its own error
 * rather than a generic pulumi failure.
 */
export function buildChildEnv(input: IBuildChildEnvInput): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};

  for (const [key, value] of Object.entries(input.parentEnv)) {
    if (value === undefined) {
      continue;
    }
    const keep = (key.startsWith(AWS_PREFIX) && !AWS_OVERRIDDEN.has(key)) || KEPT.has(key);
    if (keep) {
      env[key] = value;
    }
  }

  env["CI"] = "1";
  env["NO_COLOR"] = "1";
  env["FORCE_COLOR"] = "0";
  env["BROWSER"] = "none";

  if (input.awsProfile) {
    env["AWS_PROFILE"] = input.awsProfile;
  }
  if (input.awsRegion) {
    env["AWS_REGION"] = input.awsRegion;
  }

  return env;
}
