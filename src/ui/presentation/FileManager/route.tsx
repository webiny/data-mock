import { defineRoute } from "~/ui/features/router/defineRoute.js";
import { useFeature } from "~/ui/di/useFeature.js";
import { FileManagerPresentationFeature } from "./feature.js";
import { FileManagerPage } from "./components/FileManagerPage.js";

function FileManagerRoute() {
  const { presenter } = useFeature(FileManagerPresentationFeature);
  return <FileManagerPage presenter={presenter} />;
}

export const fileManagerRoute = defineRoute({
  name: "file-manager",
  path: "/files",
  layout: "contained",
  render: () => <FileManagerRoute />,
});
