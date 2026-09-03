import { defineRoute } from "~/ui/features/router/defineRoute.js";
import { useFeature } from "~/ui/di/useFeature.js";
import { SeedHistoryPresentationFeature } from "./feature.js";
import { SeedHistoryPage } from "./components/SeedHistoryPage.js";
import type { Route } from "~/ui/features/router/abstractions/Route.js";

function SeedHistoryRoute({ match }: { match: Route.Match }) {
  const { presenter } = useFeature(SeedHistoryPresentationFeature);
  const projectId = match.params["projectId"] ?? "";
  return <SeedHistoryPage presenter={presenter} projectId={projectId} />;
}

export const seedHistoryRoute = defineRoute({
  name: "seed-history",
  path: "/projects/:projectId/history",
  layout: "contained",
  render: (params) => <SeedHistoryRoute match={{ params }} />,
});
