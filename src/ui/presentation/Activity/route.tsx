import { defineRoute } from "~/ui/features/router/defineRoute.js";
import { useFeature } from "~/ui/di/useFeature.js";
import { ActivityPresentationFeature } from "./feature.js";
import { ActivityPage } from "./components/ActivityPage.js";

function ActivityRoute() {
  const { presenter } = useFeature(ActivityPresentationFeature);
  return <ActivityPage presenter={presenter} />;
}

export const activityRoute = defineRoute({
  name: "activity",
  path: "/activity",
  layout: "contained",
  render: () => <ActivityRoute />,
});
