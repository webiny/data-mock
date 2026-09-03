import { defineRoute } from "~/ui/features/router/defineRoute.js";
import { navigate } from "~/ui/features/router/Router.js";
import { AppRoutes } from "~/ui/features/router/routePaths.js";
import { useFeature } from "~/ui/di/useFeature.js";
import { ProjectListPresentationFeature } from "./feature.js";
import { ProjectListPage } from "./components/ProjectListPage.js";

function ProjectListRoute() {
  const { presenter } = useFeature(ProjectListPresentationFeature);
  return (
    <ProjectListPage
      presenter={presenter}
      onAddProject={() => {}}
      onOpenProject={(id) => navigate(AppRoutes.projectDetail(id))}
      onSeedProject={(id) => navigate(AppRoutes.seedConfig(id))}
      onViewHistory={(id) => navigate(AppRoutes.seedHistory(id))}
    />
  );
}

export const projectListRoute = defineRoute({
  name: "project-list",
  path: "/",
  layout: "contained",
  render: () => <ProjectListRoute />,
});
