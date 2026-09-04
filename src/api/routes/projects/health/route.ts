import { healthCheckProjectRoute } from "~/shared/routes/projects.js";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { VerifyProjectAccessService } from "~/shared/node/features/tenants/verify/abstractions/VerifyProjectAccessService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { reachable: boolean; error: string | null; checkedAt: number }>();

export const healthCheckProject = routeFactory(
  healthCheckProjectRoute,
  async ({ params, query, container, send }) => {
    const force = query.force === "true";

    if (!force) {
      const cached = cache.get(params.id);
      if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
        return send.one("health", { reachable: cached.reachable, error: cached.error });
      }
    }

    const getProject = container.resolve(GetProjectRepository);
    const verifyAccess = container.resolve(VerifyProjectAccessService);

    const projectResult = await getProject.execute({ id: params.id });
    if (projectResult.isFail()) {
      return send.error(projectResult.error);
    }

    const project = projectResult.value;
    const result = await verifyAccess.execute({
      apiUrl: project.apiUrl,
      apiToken: project.apiToken,
      tenant: project.tenant,
    });

    if (result.isFail()) {
      cache.set(params.id, {
        reachable: false,
        error: result.error.message,
        checkedAt: Date.now(),
      });
      return send.one("health", { reachable: false, error: result.error.message });
    }

    cache.set(params.id, { reachable: true, error: null, checkedAt: Date.now() });
    return send.one("health", { reachable: true, error: null });
  },
);
