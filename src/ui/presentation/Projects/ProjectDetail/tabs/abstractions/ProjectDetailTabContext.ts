import type { EnvironmentRef } from "~/shared/types.js";

/**
 * What every project detail tab needs to know about the page it is mounted on.
 *
 * It is a plain value, passed down from `ProjectDetailPage` as a prop, not a service in the
 * container: the shell presenter resolves the environment asynchronously, and React is what knows
 * when a tab is on screen. A tab presenter is handed this on `activate` and keeps no memory of
 * which tab is open.
 */
export interface ProjectDetailTabContext {
  projectId: string;
  /**
   * The resolved environment, or null while the shell is still resolving one — and on a project
   * that has none at all. A tab whose data is environment-scoped does nothing until it is set; a
   * project-scoped tab (Jobs, Templates) works without it.
   */
  ref: EnvironmentRef | null;
  /** Stack name as it appears in the URL (`dev`, `dev___blue`), for links a tab builds. */
  envName: string | null;
  /** Tenant of the current environment, `root` when there is none. */
  tenant: string;
}

/**
 * The identity of a context, for a React effect's dependency list. Two contexts with the same key
 * address the same data.
 */
export function tabContextKey(context: ProjectDetailTabContext): string {
  return `${context.projectId}|${context.ref?.environmentId ?? ""}`;
}
