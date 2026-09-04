import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Badge, Button, Card, Group, Loader, Modal, Stack, Text, Title } from "@mantine/core";
import type { ProjectListPresenter } from "../abstractions/ProjectListPresenter.js";

interface ProjectListPageProps {
  presenter: ProjectListPresenter.Interface;
  onOpenProject?: (projectId: string) => void;
  onSeedProject?: (projectId: string) => void;
  onViewHistory?: (projectId: string) => void;
}

export const ProjectListPage = observer(function ProjectListPage({
  presenter,
  onOpenProject,
  onSeedProject,
  onViewHistory,
}: ProjectListPageProps) {
  useEffect(() => {
    void presenter.load();
  }, [presenter]);

  const { projects, isLoading, isEmpty, removeConfirmation } = presenter.vm;

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
        <Text c="dimmed">
          Click &ldquo;Add Project&rdquo; in the header to get started with data seeding.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {projects.map((project) => (
        <Card key={project.id} withBorder padding="md">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Group gap="sm">
                  <Text
                    fw={600}
                    size="lg"
                    style={{ cursor: onOpenProject ? "pointer" : undefined }}
                    td={onOpenProject ? "underline" : undefined}
                    onClick={onOpenProject ? () => onOpenProject(project.id) : undefined}
                  >
                    {project.name}
                  </Text>
                  <Badge variant="light" size="sm">
                    v{project.webinyVersion}
                  </Badge>
                  <HealthDot
                    status={project.health}
                    onClick={() => presenter.refreshHealth(project.id)}
                  />
                </Group>
                <Text size="sm" c="dimmed">
                  {project.apiUrl}
                </Text>
              </Stack>
              <Group gap="xs">
                {onSeedProject && (
                  <Button variant="filled" size="xs" onClick={() => onSeedProject(project.id)}>
                    Seed Data
                  </Button>
                )}
                {onViewHistory && (
                  <Button variant="light" size="xs" onClick={() => onViewHistory(project.id)}>
                    History
                  </Button>
                )}
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  onClick={() => void presenter.confirmRemove(project.id, project.name)}
                >
                  Remove
                </Button>
              </Group>
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
                onClick={() => void presenter.pullTenants(project.id)}
              >
                Pull Tenants
              </Button>
              <Button
                variant="subtle"
                size="compact-xs"
                loading={project.isSyncingModels}
                onClick={() => void presenter.pullModels(project.id)}
              >
                Pull Models
              </Button>
            </Group>
          </Stack>
        </Card>
      ))}

      <Modal
        opened={removeConfirmation.isOpen}
        onClose={() => presenter.cancelRemove()}
        title="Remove Project"
        centered
      >
        <Text>Remove &ldquo;{removeConfirmation.projectName}&rdquo;? This cannot be undone.</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => presenter.cancelRemove()}>
            Cancel
          </Button>
          <Button color="red" onClick={() => void presenter.executeRemove()}>
            Remove
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
});

const HEALTH_COLORS: Record<string, string> = {
  unknown: "gray",
  checking: "blue",
  reachable: "green",
  unreachable: "red",
};

const HEALTH_LABELS: Record<string, string> = {
  unknown: "Not checked",
  checking: "Checking...",
  reachable: "Online",
  unreachable: "Unreachable",
};

function HealthDot({ status, onClick }: { status: string; onClick: () => void }) {
  return (
    <Badge
      variant="dot"
      color={HEALTH_COLORS[status] ?? "gray"}
      size="sm"
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
      {HEALTH_LABELS[status] ?? status}
    </Badge>
  );
}
