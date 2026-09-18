import type { Container } from "@webiny/di";
import { GetEnvironmentRepository } from "~/shared/node/features/environments/get/abstractions/GetEnvironmentRepository.js";
import { EnvironmentNotFoundError } from "~/shared/errors.js";

interface IMaybeScopedParams {
  projectId?: unknown;
  environmentId?: unknown;
}

/**
 * Checks that an environment named in a path belongs to the project named beside it.
 *
 * Every environment-scoped route carries both ids, and almost none of them checked that the two
 * agree. The consequences were not theoretical: purge destroyed the environment named by the
 * second id whatever the first said, and a destroy could be confirmed by typing the name of the
 * project in the path while tearing down a stack belonging to a different one. A stale tab or a
 * copied id was enough.
 *
 * It runs in `routeFactory` rather than in each handler so a route added later cannot forget it.
 * The cost is one indexed read from local SQLite.
 *
 * Returns the error to send, or null when there is nothing to check or nothing wrong.
 */
export async function checkEnvironmentOwnership(
  params: unknown,
  container: Container,
): Promise<unknown | null> {
  const { projectId, environmentId } = (params ?? {}) as IMaybeScopedParams;

  if (typeof projectId !== "string" || typeof environmentId !== "string") {
    return null;
  }

  const result = await container.resolve(GetEnvironmentRepository).execute({ id: environmentId });

  if (result.isFail()) {
    return result.error;
  }

  /**
   * Reported as not found rather than forbidden. This is a single-user tool on 127.0.0.1, so the
   * honest answer is that no such environment exists under that project — not that one exists
   * somewhere the caller may not look.
   */
  if (result.value.projectId !== projectId) {
    return new EnvironmentNotFoundError(environmentId);
  }

  return null;
}
