import { defineRoute } from "~/ui/features/router/defineRoute.js";
import { useFeature } from "~/ui/di/useFeature.js";
import { ProjectDetailPresentationFeature } from "./feature.js";
import { ProjectDetailPage } from "./components/ProjectDetailPage.js";
import type { Route } from "~/ui/features/router/abstractions/Route.js";

function ProjectDetailRoute({
  match,
  hasEnvironment,
}: {
  match: Route.Match;
  hasEnvironment: boolean;
}) {
  const { presenter } = useFeature(ProjectDetailPresentationFeature);
  const projectId = match.params["projectId"] ?? "";
  const envName = hasEnvironment ? (match.params["envName"] ?? null) : null;
  const subPath = match.params["_rest"] ?? "";
  return (
    <ProjectDetailPage
      presenter={presenter}
      projectId={projectId}
      envName={envName}
      subPath={subPath}
    />
  );
}

/**
 * Registered before the bare project route so it wins the first-match-wins lookup in
 * RouteRegistry — otherwise `/projects/:projectId/*` would swallow `env/dev/models` as a subPath.
 */
export const projectEnvironmentRoute = defineRoute({
  name: "project-environment",
  path: "/projects/:projectId/env/:envName/*",
  layout: "full",
  render: (params) => <ProjectDetailRoute match={{ params }} hasEnvironment={true} />,
});

/** No environment in the URL: the presenter resolves the project's first one. */
export const projectDetailRoute = defineRoute({
  name: "project-detail",
  path: "/projects/:projectId/*",
  layout: "full",
  render: (params) => <ProjectDetailRoute match={{ params }} hasEnvironment={false} />,
});
