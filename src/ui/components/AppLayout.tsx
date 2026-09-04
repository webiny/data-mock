import { useState, useCallback } from "react";
import { AppShell, Group, Title, Button, Modal } from "@mantine/core";
import { useFeature } from "../di/useFeature.js";
import { RouterView } from "../features/router/RouterView.js";
import { navigate, useCurrentPath } from "../features/router/Router.js";
import { AppRoutes } from "../features/router/routePaths.js";
import { AddProjectPresentationFeature } from "../presentation/Projects/AddProject/feature.js";
import { AddProjectForm } from "../presentation/Projects/AddProject/components/AddProjectForm.js";
import { JobNotificationListener } from "./lifecycle/JobNotificationListener.js";

export function AppLayout() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const { presenter: addPresenter } = useFeature(AddProjectPresentationFeature);
  const currentPath = useCurrentPath();
  const isActive = (path: string) => currentPath === path;

  const handleOpenAdd = useCallback(() => {
    setAddModalOpen(true);
  }, []);

  const handleCloseAdd = useCallback(() => {
    setAddModalOpen(false);
  }, []);

  const handleAddSuccess = useCallback(() => {
    setAddModalOpen(false);
    navigate("/");
  }, []);

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Title order={3} style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
              Webiny Data Mock
            </Title>
            <Button
              variant={isActive(AppRoutes.projectList()) ? "light" : "subtle"}
              size="compact-sm"
              onClick={() => navigate(AppRoutes.projectList())}
            >
              Projects
            </Button>
            <Button
              variant={isActive(AppRoutes.fileManager()) ? "light" : "subtle"}
              size="compact-sm"
              onClick={() => navigate(AppRoutes.fileManager())}
            >
              File Manager
            </Button>
          </Group>
          <Button variant="light" size="compact-sm" onClick={handleOpenAdd}>
            Add Project
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <JobNotificationListener />
        <RouterView />
      </AppShell.Main>

      <Modal opened={addModalOpen} onClose={handleCloseAdd} title="Add Project" size="md">
        <AddProjectForm presenter={addPresenter} onSuccess={handleAddSuccess} />
      </Modal>
    </AppShell>
  );
}
