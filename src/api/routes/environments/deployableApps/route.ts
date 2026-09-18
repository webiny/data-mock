import { listDeployableAppsRoute } from "~/shared/routes/environments.js";
import { GetProjectUseCase } from "~/shared/node/features/projects/get/abstractions/GetProjectUseCase.js";
import { WebinyProjectDetector } from "~/shared/node/features/webinyCli/detect/abstractions/WebinyProjectDetector.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

/**
 * Read from disk on every call rather than stored. It is a handful of file reads, and a stored
 * copy would go stale the moment the checkout changed version.
 */
export const listDeployableApps = routeFactory(
  listDeployableAppsRoute,
  async ({ params, container, send }) => {
    const projectResult = await container
      .resolve(GetProjectUseCase)
      .execute({ id: params.projectId });

    if (projectResult.isFail()) {
      return send.error(projectResult.error);
    }

    const project = projectResult.value;

    // A remote-only project has nothing on disk, so there is nothing it can deploy.
    if (project.rootPath === null) {
      return send.one("deployable", { apps: [], versionMajor: null });
    }

    const detected = await container
      .resolve(WebinyProjectDetector)
      .execute({ rootPath: project.rootPath });

    if (detected.isFail()) {
      return send.error(detected.error);
    }

    return send.one("deployable", {
      apps: detected.value.apps,
      versionMajor: detected.value.versionMajor,
    });
  },
);
