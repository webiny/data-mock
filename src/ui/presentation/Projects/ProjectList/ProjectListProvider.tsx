import type { ReactNode } from "react";
import { useFeature } from "~/ui/di/useFeature.js";
import { ProjectListPresentationFeature } from "./feature.js";
import { ProjectListPage } from "./components/ProjectListPage.js";

interface ProjectListProviderProps {
  children?: ReactNode;
}

export function ProjectListProvider(_props: ProjectListProviderProps) {
  const { presenter } = useFeature(ProjectListPresentationFeature);
  return <ProjectListPage presenter={presenter} />;
}
