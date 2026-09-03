import { useState, useCallback } from "react";
import { AppShell, Group, Title, Text, Container, Modal } from "@mantine/core";
import { useFeature } from "../di/useFeature.js";
import { ProjectListPresentationFeature } from "../presentation/Projects/ProjectList/feature.js";
import { AddProjectPresentationFeature } from "../presentation/Projects/AddProject/feature.js";
import { ProjectListPage } from "../presentation/Projects/ProjectList/components/ProjectListPage.js";
import { AddProjectForm } from "../presentation/Projects/AddProject/components/AddProjectForm.js";

export function AppLayout() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const { presenter: listPresenter } = useFeature(ProjectListPresentationFeature);
  const { presenter: addPresenter } = useFeature(AddProjectPresentationFeature);

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
          <ProjectListPage presenter={listPresenter} onAddProject={handleOpenAdd} />
        </Container>
      </AppShell.Main>

      <Modal opened={addModalOpen} onClose={handleCloseAdd} title="Add Project" size="md">
        <AddProjectForm presenter={addPresenter} onSuccess={handleAddSuccess} />
      </Modal>
    </AppShell>
  );
}
