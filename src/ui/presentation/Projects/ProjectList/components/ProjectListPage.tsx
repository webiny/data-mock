import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Badge, Button, Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import type { ProjectListPresenter } from "../abstractions/ProjectListPresenter.js";

interface ProjectListPageProps {
  presenter: ProjectListPresenter.Interface;
  onAddProject: () => void;
}

export const ProjectListPage = observer(function ProjectListPage({
  presenter,
  onAddProject,
}: ProjectListPageProps) {
  useEffect(() => {
    void presenter.load();
  }, [presenter]);

  const { projects, isLoading, isEmpty } = presenter.vm;

  if (isLoading) {
    return (
      <Stack align="center" mt="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading projects...</Text>
      </Stack>
    );
  }

  if (isEmpty) {
    return (
      <Stack align="center" mt="xl" gap="md">
        <Title order={3}>No projects configured</Title>
        <Text c="dimmed">Add a Webiny project to get started with data seeding.</Text>
        <Button onClick={onAddProject}>Add Project</Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Projects</Title>
        <Button onClick={onAddProject}>Add Project</Button>
      </Group>

      {projects.map((project) => (
        <Card key={project.id} withBorder padding="md">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Group gap="sm">
                  <Text fw={600} size="lg">
                    {project.name}
                  </Text>
                  <Badge variant="light" size="sm">
                    v{project.webinyVersion}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {project.apiUrl}
                </Text>
              </Stack>
              <Button
                variant="subtle"
                color="red"
                size="xs"
                onClick={() => void presenter.remove(project.id)}
              >
                Remove
              </Button>
            </Group>

            <Group gap="xs">
              <Text size="xs" fw={500} c="dimmed">
                Tenants:
              </Text>
              {project.tenants.length === 0 && (
                <Text size="xs" c="dimmed" fs="italic">
                  None discovered
                </Text>
              )}
              {project.tenants.map((t) => (
                <Badge key={t.tenantId} variant="outline" size="xs">
                  {t.name}
                </Badge>
              ))}
              <Button
                variant="subtle"
                size="compact-xs"
                loading={project.isSyncing}
                onClick={() => void presenter.syncTenants(project.id)}
              >
                Sync
              </Button>
            </Group>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
});
