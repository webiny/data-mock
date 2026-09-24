import {
  deriveCmsEndpoints,
  resolveAdminOutputs,
  resolveApiOutputs,
  resolveCoreOutputs,
} from "~/shared/stackOutput/stackOutputKeyMap.js";
import type { ProjectStack } from "~/shared/types.js";
import type {
  IEnvironmentVM,
  ISystemInfoSectionVM,
} from "./abstractions/ProjectDetailPresenter.js";

/** The stored output of one app, whether or not it is still deployed. */
function rawOutput(stacks: ProjectStack[], app: string): Record<string, unknown> | null {
  return stacks.find((candidate) => candidate.app === app)?.stackOutput ?? null;
}

/**
 * The infrastructure facts worth surfacing, resolved from the raw Pulumi output through the
 * per-major key map. Absent keys are omitted rather than rendered blank: a DynamoDB-only project
 * has no search keys at all, and VPC keys appear only when VPC is enabled.
 */
export function buildSystemInfo(
  stacks: ProjectStack[],
  environment: IEnvironmentVM | null,
  versionMajor: number | null,
): ISystemInfoSectionVM[] {
  if (environment === null || versionMajor === null) {
    return [];
  }

  const sections: ISystemInfoSectionVM[] = [];

  const apiItems = resolveApiOutputs(rawOutput(stacks, "api"), versionMajor);
  if (environment.apiUrl !== null) {
    // CMS endpoints are derived from the base URL, never stored — operations append their own
    // path, so persisting them would duplicate the base and drift from it.
    apiItems.push(...deriveCmsEndpoints(environment.apiUrl));
  }

  if (apiItems.length > 0) {
    sections.push({ title: "API", items: apiItems });
  }

  const adminItems = resolveAdminOutputs(rawOutput(stacks, "admin"), versionMajor);
  if (adminItems.length > 0) {
    sections.push({ title: "Admin", items: adminItems });
  }

  const coreItems = resolveCoreOutputs(rawOutput(stacks, "core"), versionMajor);
  if (coreItems.length > 0) {
    sections.push({ title: "Core", items: coreItems });
  }

  return sections;
}

/** Says why the panel is empty. An empty panel with no explanation reads as a broken page. */
export function systemInfoNotice(
  stacks: ProjectStack[],
  environment: IEnvironmentVM | null,
): string | null {
  if (environment === null) {
    return "No environment selected.";
  }
  if (stacks.length === 0) {
    return "This environment has never been synced. Run a sync to read its stack output.";
  }
  if (stacks.every((stack) => stack.readState === "unknown")) {
    return "None of this environment's stacks could be read. Their last known output is kept.";
  }
  if (!environment.deployed) {
    return "This environment is not deployed, so it has no infrastructure to report.";
  }
  return null;
}

/**
 * The named things a destroy takes with it — tables, buckets, user pools — pulled through the same
 * key map the System Info panel uses, so the two never name the same resource differently.
 *
 * Only a deployed stack is read: a destroyed one keeps its last output, and listing that as at risk
 * would offer to destroy what is already gone.
 */
export function namedResourcesAtRisk(
  stacks: ProjectStack[],
  apps: string[],
  versionMajor: number | null,
): Array<{ label: string; value: string }> {
  if (versionMajor === null) {
    return [];
  }

  const deployedOutput = (app: string): Record<string, unknown> | null => {
    const stack = stacks.find((candidate) => candidate.app === app);
    return stack !== undefined && stack.deployed ? stack.stackOutput : null;
  };

  const resolved: Array<{ label: string; value: string }> = [];

  if (apps.includes("core")) {
    resolved.push(...resolveCoreOutputs(deployedOutput("core"), versionMajor));
  }
  if (apps.includes("api")) {
    resolved.push(...resolveApiOutputs(deployedOutput("api"), versionMajor));
  }
  if (apps.includes("admin")) {
    resolved.push(...resolveAdminOutputs(deployedOutput("admin"), versionMajor));
  }

  return resolved;
}
