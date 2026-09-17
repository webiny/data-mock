import { healthCheckEnvironmentRoute } from "~/shared/routes/environments.js";
import { EnvironmentContextService } from "~/shared/node/features/environments/context/abstractions/EnvironmentContextService.js";
import { VerifyProjectAccessService } from "~/shared/node/features/tenants/verify/abstractions/VerifyProjectAccessService.js";
import { EnvironmentHealthCache } from "~/api/health/abstractions/EnvironmentHealthCache.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const healthCheckEnvironment = routeFactory(
  healthCheckEnvironmentRoute,
  async ({ params, query, container, send }) => {
    const cache = container.resolve(EnvironmentHealthCache);
    const environmentId = params.environmentId;

    if (query.force !== "true") {
      const cached = cache.get(environmentId);
      if (cached) {
        return send.one("health", cached);
      }
    }

    const environmentContext = container.resolve(EnvironmentContextService);
    const verifyAccess = container.resolve(VerifyProjectAccessService);

    const contextResult = await environmentContext.execute({ environmentId });

    /**
     * A partially deployed environment — core up, api not — is not an error to report as a 409
     * here. "Can I reach this API?" has a truthful answer: no, and this is why.
     */
    if (contextResult.isFail()) {
      return send.one("health", store(cache, environmentId, false, contextResult.error.message));
    }

    const { apiUrl, apiToken, tenant } = contextResult.value;
    const result = await verifyAccess.execute({ apiUrl, apiToken, tenant });

    if (result.isFail()) {
      return send.one("health", store(cache, environmentId, false, result.error.message));
    }

    return send.one("health", store(cache, environmentId, true, null));
  },
);

function store(
  cache: EnvironmentHealthCache.Interface,
  environmentId: string,
  reachable: boolean,
  error: string | null,
): EnvironmentHealthCache.Health {
  const health = { reachable, error };
  cache.set(environmentId, health);
  return health;
}
