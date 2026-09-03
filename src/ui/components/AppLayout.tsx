import { useState, useCallback } from "react";
import { AppShell, Group, Title, Text, Container, Modal } from "@mantine/core";
import { useFeature } from "../di/useFeature.js";
import { ProjectListPresentationFeature } from "../presentation/Projects/ProjectList/feature.js";
import { AddProjectPresentationFeature } from "../presentation/Projects/AddProject/feature.js";
import { SeedConfigPresentationFeature } from "../presentation/Seeding/SeedConfig/feature.js";
import { SeedHistoryPresentationFeature } from "../presentation/Seeding/SeedHistory/feature.js";
import { ProjectListPage } from "../presentation/Projects/ProjectList/components/ProjectListPage.js";
import { AddProjectForm } from "../presentation/Projects/AddProject/components/AddProjectForm.js";
import { SeedConfigPage } from "../presentation/Seeding/SeedConfig/components/SeedConfigPage.js";
import { SeedHistoryPage } from "../presentation/Seeding/SeedHistory/components/SeedHistoryPage.js";

export function AppLayout() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [seedProjectId, setSeedProjectId] = useState<string | null>(null);
  const [historyProjectId, setHistoryProjectId] = useState<string | null>(null);

  const { presenter: listPresenter } = useFeature(ProjectListPresentationFeature);
  const { presenter: addPresenter } = useFeature(AddProjectPresentationFeature);
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

  const handleOpenSeed = useCallback((projectId: string) => {
    setSeedProjectId(projectId);
  }, []);

  const handleCloseSeed = useCallback(() => {
    setSeedProjectId(null);
  }, []);

  const handleOpenHistory = useCallback((projectId: string) => {
    setHistoryProjectId(projectId);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setHistoryProjectId(null);
  }, []);

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Title order={3}>Webiny Data Mock</Title>
          </Group>
          <Text size="sm" c="dimmed">
            Project Manager
          </Text>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="lg" py="md">
          <ProjectListPage
            presenter={listPresenter}
            onAddProject={handleOpenAdd}
            onSeedProject={handleOpenSeed}
            onViewHistory={handleOpenHistory}
          />
        </Container>
      </AppShell.Main>

      <Modal opened={addModalOpen} onClose={handleCloseAdd} title="Add Project" size="md">
        <AddProjectForm presenter={addPresenter} onSuccess={handleAddSuccess} />
      </Modal>

      <Modal opened={seedProjectId !== null} onClose={handleCloseSeed} title="Seed Data" size="lg">
        {seedProjectId && <SeedConfigPage presenter={seedPresenter} projectId={seedProjectId} />}
      </Modal>

      <Modal
        opened={historyProjectId !== null}
        onClose={handleCloseHistory}
        title="Seed History"
        size="lg"
      >
        {historyProjectId && (
          <SeedHistoryPage presenter={historyPresenter} projectId={historyProjectId} />
        )}
      </Modal>
    </AppShell>
  );
}
