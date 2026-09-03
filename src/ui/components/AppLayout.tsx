import { useState, useCallback } from "react";
import { AppShell, Group, Title, Button, Modal } from "@mantine/core";
import { useFeature } from "../di/useFeature.js";
import { RouterView } from "../features/router/RouterView.js";
import { navigate } from "../features/router/Router.js";
import { AddProjectPresentationFeature } from "../presentation/Projects/AddProject/feature.js";
import { AddProjectForm } from "../presentation/Projects/AddProject/components/AddProjectForm.js";

export function AppLayout() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const { presenter: addPresenter } = useFeature(AddProjectPresentationFeature);

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
          </Group>
          <Button variant="light" size="compact-sm" onClick={handleOpenAdd}>
            Add Project
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <RouterView />
      </AppShell.Main>

      <Modal opened={addModalOpen} onClose={handleCloseAdd} title="Add Project" size="md">
        <AddProjectForm presenter={addPresenter} onSuccess={handleAddSuccess} />
      </Modal>
    </AppShell>
  );
}
