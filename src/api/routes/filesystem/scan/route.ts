import { scanForProjectsRoute } from "~/shared/routes/filesystem.js";
import { ProjectScanner } from "~/shared/node/features/filesystem/scan/abstractions/ProjectScanner.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const scanForProjects = routeFactory(
  scanForProjectsRoute,
  async ({ body, container, send }) => {
    const scanner = container.resolve(ProjectScanner);
    const result = await scanner.execute({ paths: body.paths, maxDepth: body.maxDepth });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("scan", result.value);
  },
);
