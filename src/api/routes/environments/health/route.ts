import { healthCheckEnvironmentRoute } from "~/shared/routes/environments.js";
import { EnvironmentContextService } from "~/shared/node/features/environments/context/abstractions/EnvironmentContextService.js";
import { VerifyProjectAccessService } from "~/shared/node/features/tenants/verify/abstractions/VerifyProjectAccessService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { reachable: boolean; error: string | null; checkedAt: number }>();

export const healthCheckEnvironment = routeFactory(
  healthCheckEnvironmentRoute,
  async ({ params, query, container, send }) => {
    const force = query.force === "true";
    const cacheKey = params.environmentId;

    if (!force) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
        return send.one("health", { reachable: cached.reachable, error: cached.error });
      }
    }

    const environmentContext = container.resolve(EnvironmentContextService);
    const verifyAccess = container.resolve(VerifyProjectAccessService);

    const contextResult = await environmentContext.execute({
      environmentId: params.environmentId,
    });

    /**
     * A partially deployed environment — core up, api not — is not an error to report as a 409
     * here. "Can I reach this API?" has a truthful answer: no, and this is why.
     */
    if (contextResult.isFail()) {
      const message = contextResult.error.message;
      cache.set(cacheKey, { reachable: false, error: message, checkedAt: Date.now() });
      return send.one("health", { reachable: false, error: message });
    }

    const { apiUrl, apiToken, tenant } = contextResult.value;

    const result = await verifyAccess.execute({ apiUrl, apiToken, tenant });

    if (result.isFail()) {
      cache.set(cacheKey, {
        reachable: false,
        error: result.error.message,
        checkedAt: Date.now(),
      });
      return send.one("health", { reachable: false, error: result.error.message });
    }

    cache.set(cacheKey, { reachable: true, error: null, checkedAt: Date.now() });
    return send.one("health", { reachable: true, error: null });
  },
);
