import { useState, useCallback } from "react";
import { observer } from "mobx-react-lite";
import { AppShell, Box, Group, Title, Text, Container, Modal, Button } from "@mantine/core";
import { useContainer } from "../di/DiContainerProvider.js";
import { useFeature } from "../di/useFeature.js";
import { Router } from "../features/router/abstractions/Router.js";
import { ProjectListPresentationFeature } from "../presentation/Projects/ProjectList/feature.js";
import { AddProjectPresentationFeature } from "../presentation/Projects/AddProject/feature.js";
import { ProjectDetailPresentationFeature } from "../presentation/Projects/ProjectDetail/feature.js";
import { SeedConfigPresentationFeature } from "../presentation/Seeding/SeedConfig/feature.js";
import { SeedHistoryPresentationFeature } from "../presentation/Seeding/SeedHistory/feature.js";
import { ProjectListPage } from "../presentation/Projects/ProjectList/components/ProjectListPage.js";
import { AddProjectForm } from "../presentation/Projects/AddProject/components/AddProjectForm.js";
import { ProjectDetailPage } from "../presentation/Projects/ProjectDetail/components/ProjectDetailPage.js";
import { SeedConfigPage } from "../presentation/Seeding/SeedConfig/components/SeedConfigPage.js";
import { SeedHistoryPage } from "../presentation/Seeding/SeedHistory/components/SeedHistoryPage.js";

export const AppLayout = observer(function AppLayout() {
  const container = useContainer();
  const router = container.resolve(Router);

  const [addModalOpen, setAddModalOpen] = useState(false);

  const { presenter: listPresenter } = useFeature(ProjectListPresentationFeature);
  const { presenter: addPresenter } = useFeature(AddProjectPresentationFeature);
  const { presenter: detailPresenter } = useFeature(ProjectDetailPresentationFeature);
  const { presenter: seedPresenter } = useFeature(SeedConfigPresentationFeature);
  const { presenter: historyPresenter } = useFeature(SeedHistoryPresentationFeature);

  const handleOpenAdd = useCallback(() => {
    setAddModalOpen(true);
  }, []);

  const handleCloseAdd = useCallback(() => {
    setAddModalOpen(false);
  }, []);

  const handleAddSuccess = useCallback(() => {
    setAddModalOpen(false);
    void listPresenter.load();
  }, [listPresenter]);

  const handleOpenProject = useCallback(
    (projectId: string) => {
      router.navigate("project-detail", { projectId });
    },
    [router],
  );

  const handleSeedProject = useCallback(
    (projectId: string) => {
      router.navigate("seed-config", { projectId });
    },
    [router],
  );

  const handleViewHistory = useCallback(
    (projectId: string) => {
      router.navigate("seed-history", { projectId });
    },
    [router],
  );

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Title
              order={3}
              style={{ cursor: "pointer" }}
              onClick={() => router.navigate("project-list")}
            >
              Webiny Data Mock
            </Title>
            {router.currentView !== "project-list" && (
              <Button variant="subtle" size="compact-sm" onClick={() => router.goBack()}>
                Back
              </Button>
            )}
          </Group>
          <Text size="sm" c="dimmed">
            {viewLabel(router.currentView)}
          </Text>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        {router.currentView === "project-list" && (
          <Container size="lg" py="md">
            <ProjectListPage
              presenter={listPresenter}
              onAddProject={handleOpenAdd}
              onOpenProject={handleOpenProject}
              onSeedProject={handleSeedProject}
              onViewHistory={handleViewHistory}
            />
          </Container>
        )}

        {router.currentView === "project-detail" && router.params["projectId"] && (
          <Box p="md">
            <ProjectDetailPage presenter={detailPresenter} projectId={router.params["projectId"]} />
          </Box>
        )}

        {router.currentView === "seed-config" && router.params["projectId"] && (
          <Container size="lg" py="md">
            <SeedConfigPage presenter={seedPresenter} projectId={router.params["projectId"]} />
          </Container>
        )}

        {router.currentView === "seed-history" && router.params["projectId"] && (
          <Container size="lg" py="md">
            <SeedHistoryPage presenter={historyPresenter} projectId={router.params["projectId"]} />
          </Container>
        )}
      </AppShell.Main>

      <Modal opened={addModalOpen} onClose={handleCloseAdd} title="Add Project" size="md">
        <AddProjectForm presenter={addPresenter} onSuccess={handleAddSuccess} />
      </Modal>
    </AppShell>
  );
});

function viewLabel(view: string): string {
  switch (view) {
    case "project-list":
      return "Projects";
    case "project-detail":
      return "Project Details";
    case "seed-config":
      return "Seed Configuration";
    case "seed-history":
      return "Seed History";
    default:
      return "";
  }
}
