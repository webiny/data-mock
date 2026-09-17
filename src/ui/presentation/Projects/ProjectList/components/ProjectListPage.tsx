import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
  Alert,
  Badge,
  Tooltip,
  Button,
  Card,
  Divider,
  Group,
  List,
  Loader,
  Modal,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type {
  ProjectHealth,
  ProjectItemVM,
  ProjectListPresenter,
} from "../abstractions/ProjectListPresenter.js";
import { SyncPreviewDialog } from "~/ui/components/SyncPreviewDialog.js";

interface ProjectListPageProps {
  presenter: ProjectListPresenter.Interface;
  onOpenProject?: (projectId: string) => void;
  onSeedProject?: (projectId: string) => void;
  onViewHistory?: (projectId: string) => void;
}

function formatRelative(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
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

  const {
    projects,
    archivedProjects,
    isLoading,
    isEmpty,
    deleteConfirmation,
    isSyncingAll,
    syncableCount,
    syncPreview,
    loadError,
  } = presenter.vm;

  if (isLoading) {
    return (
      <Stack align="center" mt="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading projects...</Text>
      </Stack>
    );
  }

  if (loadError !== null) {
    return (
      <Alert color="red" title="Could not load the projects" mt="xl">
        {loadError}
      </Alert>
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

  const isPurge = deleteConfirmation.mode === "purge";

  return (
    <Stack gap="md">
      {syncableCount > 0 && (
        <Group justify="flex-end">
          <Button
            size="xs"
            variant="light"
            loading={isSyncingAll}
            onClick={() => void presenter.syncAll()}
          >
            Sync all ({syncableCount})
          </Button>
        </Group>
      )}

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
                    {project.webinyVersion ? `v${project.webinyVersion}` : "workspace root"}
                  </Badge>
                  <HealthBadge
                    project={project}
                    onRefresh={() => void presenter.refreshHealth(project.id)}
                  />
                </Group>
                <Text size="sm" c="dimmed">
                  {project.rootPath ?? "remote only — no local checkout"}
                </Text>
              </Stack>
              <Group gap="xs">
                {/*
                  Both of these open an environment, so a project with none to open — never
                  deployed, or deployed without its api app — offers neither. A Seed Data button
                  that can only lead to "this environment cannot be seeded" is worse than no button.
                */}
                {onSeedProject && project.seedable && (
                  <Button variant="filled" size="xs" onClick={() => onSeedProject(project.id)}>
                    Seed Data
                  </Button>
                )}
                {onViewHistory && project.seedable && (
                  <Button variant="light" size="xs" onClick={() => onViewHistory(project.id)}>
                    History
                  </Button>
                )}
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  onClick={() => presenter.confirmDelete(project.id, project.name)}
                >
                  Remove
                </Button>
              </Group>
            </Group>

            <Group gap="xs">
              <Text size="xs" fw={500} c="dimmed">
                Environments:
              </Text>
              {project.environmentCount === 0 && (
                <Text size="xs" c="dimmed" fs="italic">
                  None discovered — sync to find them
                </Text>
              )}
              {project.environmentCount > 0 && (
                <Badge variant="outline" size="xs">
                  {project.deployedCount} of {project.environmentCount} deployed
                </Badge>
              )}
              <Text size="xs" c="dimmed">
                {project.lastSyncedAt
                  ? `synced ${formatRelative(project.lastSyncedAt)}`
                  : "never synced"}
              </Text>
              {project.syncable && (
                <Button
                  variant="subtle"
                  size="compact-xs"
                  loading={project.isSyncing}
                  onClick={() => void presenter.syncProject(project.id)}
                >
                  Sync
                </Button>
              )}
            </Group>
          </Stack>
        </Card>
      ))}

      {archivedProjects.length > 0 && (
        <>
          <Divider my="sm" label={`Archived (${archivedProjects.length})`} labelPosition="left" />
          {archivedProjects.map((project) => (
            <ArchivedProjectCard key={project.id} project={project} presenter={presenter} />
          ))}
        </>
      )}

      <Modal
        opened={deleteConfirmation.isOpen}
        onClose={() => presenter.cancelDelete()}
        title={isPurge ? "Delete permanently" : "Remove Project"}
        centered
      >
        <Stack gap="sm">
          <Text>
            {isPurge ? "Permanently delete" : "Archive"} &ldquo;
            {deleteConfirmation.projectName}&rdquo;?
          </Text>

          {!isPurge && (
            <Text size="sm" c="dimmed">
              Archiving hides the project and keeps everything below. You can restore it at any
              time.
            </Text>
          )}

          {deleteConfirmation.seeded && (
            <Text size="sm" c="dimmed">
              This project is listed in <code>.projects.json</code>, which recreates it every time
              the server starts, so it cannot be deleted. Remove it from that file first.
            </Text>
          )}

          <DeletionImpactPanel confirmation={deleteConfirmation} isPurge={isPurge} />

          <Group justify="space-between" mt="md">
            {isPurge || deleteConfirmation.seeded ? (
              <Button variant="default" onClick={() => presenter.cancelDelete()}>
                Cancel
              </Button>
            ) : (
              <Button
                variant="subtle"
                color="red"
                size="xs"
                onClick={() => presenter.requestPurge()}
              >
                Delete permanently instead
              </Button>
            )}
            <Group gap="xs">
              {!isPurge && !deleteConfirmation.seeded && (
                <Button variant="default" onClick={() => presenter.cancelDelete()}>
                  Cancel
                </Button>
              )}
              {isPurge ? (
                <Button color="red" onClick={() => void presenter.purge()}>
                  Delete everything
                </Button>
              ) : (
                <Button color="orange" onClick={() => void presenter.archive()}>
                  Archive
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </Modal>

      <SyncPreviewDialog
        vm={syncPreview}
        onApply={() => void presenter.applySync()}
        onClose={() => presenter.closeSyncPreview()}
      />
    </Stack>
  );
});

const HEALTH_COLOR: Record<ProjectHealth, string> = {
  unknown: "gray",
  checking: "blue",
  online: "green",
  partial: "yellow",
  unreachable: "red",
  // Nothing to reach is not a failure: a checkout that has never been deployed has no API yet.
  "no-endpoint": "gray",
};

const HEALTH_TEXT: Record<ProjectHealth, string> = {
  unknown: "not checked",
  checking: "checking",
  online: "online",
  partial: "partly online",
  unreachable: "unreachable",
  "no-endpoint": "no API",
};

function HealthBadge({ project, onRefresh }: { project: ProjectItemVM; onRefresh: () => void }) {
  const clickable = project.health !== "checking" && project.health !== "no-endpoint";

  return (
    <Tooltip label={project.healthLabel}>
      <Badge
        variant="dot"
        size="sm"
        color={HEALTH_COLOR[project.health]}
        style={{ cursor: clickable ? "pointer" : "default" }}
        onClick={clickable ? onRefresh : undefined}
      >
        {HEALTH_TEXT[project.health]}
      </Badge>
    </Tooltip>
  );
}

interface DeletionImpactPanelProps {
  confirmation: ProjectListPresenter.ViewModel["deleteConfirmation"];
  isPurge: boolean;
}

/**
 * The counts are the whole point of the two-step confirmation, so a failed or pending count must
 * never render as an empty list — that would read as "nothing will be lost".
 */
const DeletionImpactPanel = observer(function DeletionImpactPanel({
  confirmation,
  isPurge,
}: DeletionImpactPanelProps) {
  if (confirmation.isLoadingImpact) {
    return (
      <Group gap="xs">
        <Loader size="xs" />
        <Text size="sm" c="dimmed">
          Counting what a permanent delete would destroy...
        </Text>
      </Group>
    );
  }

  if (confirmation.impact.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No stored data was found for this project.
      </Text>
    );
  }

  return (
    <Alert color={isPurge ? "red" : "yellow"} variant="light">
      <Text size="sm" fw={500}>
        {isPurge
          ? `${confirmation.impactTotal} rows will be destroyed:`
          : `${confirmation.impactTotal} rows are kept by archiving:`}
      </Text>
      <List size="sm" mt="xs">
        {confirmation.impact.map((line) => (
          <List.Item key={line.label}>
            {line.count} {line.label}
          </List.Item>
        ))}
      </List>
      {isPurge && (
        <Text size="sm" fw={600} mt="xs">
          This cannot be undone.
        </Text>
      )}
    </Alert>
  );
});

interface ArchivedProjectCardProps {
  project: ProjectItemVM;
  presenter: ProjectListPresenter.Interface;
}

const ArchivedProjectCard = observer(function ArchivedProjectCard({
  project,
  presenter,
}: ArchivedProjectCardProps) {
  return (
    <Card withBorder padding="md" opacity={0.7}>
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Group gap="sm">
            <Text fw={600}>{project.name}</Text>
            <Badge variant="light" color="gray" size="sm">
              archived
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {project.rootPath ?? "remote only — no local checkout"}
          </Text>
        </Stack>
        <Group gap="xs">
          <Button variant="light" size="xs" onClick={() => void presenter.restore(project.id)}>
            Restore
          </Button>
          {project.seeded ? (
            <Tooltip label="Listed in .projects.json, which recreates it on every start. Remove it from that file to delete it.">
              <Text size="xs" c="dimmed">
                seeded
              </Text>
            </Tooltip>
          ) : (
            <Button
              variant="subtle"
              color="red"
              size="xs"
              onClick={() => presenter.confirmDelete(project.id, project.name)}
            >
              Delete
            </Button>
          )}
        </Group>
      </Group>
    </Card>
  );
});
