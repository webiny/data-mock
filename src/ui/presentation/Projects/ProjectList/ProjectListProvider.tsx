import type { ReactNode } from "react";
import { useFeature } from "~/ui/di/useFeature.js";
import { ProjectListPresentationFeature } from "./feature.js";
import { ProjectListPage } from "./components/ProjectListPage.js";

interface ProjectListProviderProps {
  onAddProject: () => void;
  children?: ReactNode;
}

export function ProjectListProvider({ onAddProject }: ProjectListProviderProps) {
  const { presenter } = useFeature(ProjectListPresentationFeature);
  return <ProjectListPage presenter={presenter} onAddProject={onAddProject} />;
}
