import { healthCheckProjectRoute } from "~/shared/routes/projects.js";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { VerifyProjectAccessService } from "~/shared/node/features/tenants/verify/abstractions/VerifyProjectAccessService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const healthCheckProject = routeFactory(
  healthCheckProjectRoute,
  async ({ params, container, send }) => {
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
      return send.one("health", { reachable: false, error: result.error.message });
    }

    return send.one("health", { reachable: true, error: null });
  },
);
