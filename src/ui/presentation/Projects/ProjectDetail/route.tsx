import { defineRoute } from "~/ui/features/router/defineRoute.js";
import { useFeature } from "~/ui/di/useFeature.js";
import { ProjectDetailPresentationFeature } from "./feature.js";
import { ProjectDetailPage } from "./components/ProjectDetailPage.js";
import type { Route } from "~/ui/features/router/abstractions/Route.js";

function ProjectDetailRoute({ match }: { match: Route.Match }) {
  const { presenter } = useFeature(ProjectDetailPresentationFeature);
  const projectId = match.params["projectId"] ?? "";
  return <ProjectDetailPage presenter={presenter} projectId={projectId} />;
}

export const projectDetailRoute = defineRoute({
  name: "project-detail",
  path: "/projects/:projectId",
  layout: "full",
  render: (params) => <ProjectDetailRoute match={{ params }} />,
});
