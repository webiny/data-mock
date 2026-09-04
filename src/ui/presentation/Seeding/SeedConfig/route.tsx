import { defineRoute } from "~/ui/features/router/defineRoute.js";
import { useFeature } from "~/ui/di/useFeature.js";
import { SeedConfigPresentationFeature } from "./feature.js";
import { SeedConfigPage } from "./components/SeedConfigPage.js";
import type { Route } from "~/ui/features/router/abstractions/Route.js";

function SeedConfigRoute({ match }: { match: Route.Match }) {
  const { presenter } = useFeature(SeedConfigPresentationFeature);
  const projectId = match.params["projectId"] ?? "";
  return <SeedConfigPage presenter={presenter} projectId={projectId} />;
}

export const seedConfigRoute = defineRoute({
  name: "seed-config",
  path: "/projects/:projectId/seed",
  layout: "contained",
  render: (params) => <SeedConfigRoute match={{ params }} />,
});
