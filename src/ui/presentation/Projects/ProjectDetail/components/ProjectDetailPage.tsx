import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  NavLink,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import { useFeature } from "~/ui/di/useFeature.js";
import { SeedConfigPresentationFeature } from "~/ui/presentation/Seeding/SeedConfig/feature.js";
import { SeedConfigPage } from "~/ui/presentation/Seeding/SeedConfig/components/SeedConfigPage.js";
import { TenantsTab } from "./TenantsTab.js";
import { ModelsTab } from "./ModelsTab.js";
import { SeedHistoryTab } from "./SeedHistoryTab.js";
import { TemplatesTab } from "./TemplatesTab.js";
import { FilesTab } from "./FilesTab.js";
import { AuditLogTab } from "./AuditLogTab.js";
import { SyncTenantsTab } from "./SyncTenantsTab.js";
import { SyncModelsTab } from "./SyncModelsTab.js";
import { ImportEntriesTab } from "./ImportEntriesTab.js";
import { JobsTab } from "./JobsTab.js";
import { EditProjectForm } from "./EditProjectForm.js";
import { navigate } from "~/ui/features/router/Router.js";
import { AppRoutes } from "~/ui/features/router/routePaths.js";

interface ProjectDetailPageProps {
  presenter: ProjectDetailPresenter.Interface;
  projectId: string;
  subPath: string;
}

const VIEW_DEFAULT = "tenants";

function resolveView(subPath: string): string {
  if (!subPath) {
    return VIEW_DEFAULT;
  }
  return subPath;
}

export const ProjectDetailPage = observer(function ProjectDetailPage({
  presenter,
  projectId,
  subPath,
}: ProjectDetailPageProps) {
  const activeView = resolveView(subPath);

  useEffect(() => {
    void presenter.load(projectId);
    return () => presenter.dispose();
  }, [presenter, projectId]);

  useEffect(() => {
    void presenter.activateView(activeView);
  }, [presenter, activeView]);

  const vm = presenter.vm;
  const {
    project,
    tenants,
    groups,
    models,
    seedJobs,
    templates,
    entries,
    syncLog,
    isLoading,
    isSyncingTenants,
    isSyncingModels,
    isImporting,
    isClearingEntries,
    isCleaningUp,
    isUploadingGlobal,
    showEditDialog,
    showCleanupDialog,
  } = vm;

  if (isLoading) {
    return (
      <Stack align="center" mt="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading project details...</Text>
      </Stack>
    );
  }

  if (!project) {
    return (
      <Stack align="center" mt="xl">
        <Text c="dimmed">Project not found.</Text>
      </Stack>
    );
  }

  const goTo = (tab: string) => {
    if (tab === VIEW_DEFAULT) {
      navigate(AppRoutes.projectDetail(projectId));
    } else {
      navigate(AppRoutes.projectTab(projectId, tab));
    }
  };

  return (
    <>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="sm">
              <Title order={2}>{project.name}</Title>
              <Badge variant="light">v{project.webinyVersion}</Badge>
              <HealthBadge
                status={vm.projectHealth}
                error={vm.projectHealthError}
                onCheck={() => void presenter.checkHealth()}
              />
            </Group>
            <Text size="sm" c="dimmed">
              {project.apiUrl}
            </Text>
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                Default tenant:
              </Text>
              <Badge size="xs" variant="outline">
                {project.tenant}
              </Badge>
            </Group>
          </Stack>
        </Group>

        <Group align="flex-start" gap={0} wrap="nowrap" style={{ width: "100%" }}>
          <Paper
            w={250}
            maw={250}
            p="xs"
            withBorder
            style={{ flexShrink: 0, alignSelf: "stretch" }}
          >
            <Stack gap={2}>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="sm" pt="xs" pb={4}>
                Data
              </Text>
              <NavLink
                label="Tenants"
                active={activeView === "tenants"}
                onClick={() => goTo("tenants")}
              />
              <NavLink
                label="Models & Groups"
                active={activeView === "models"}
                onClick={() => goTo("models")}
              />
              <NavLink
                label="Files"
                active={activeView === "files"}
                onClick={() => goTo("files")}
              />
              <NavLink
                label="Audit Log"
                active={activeView === "entries"}
                onClick={() => goTo("entries")}
              />
              <NavLink
                label="Seed History"
                active={activeView === "history"}
                onClick={() => goTo("history")}
              />
              <NavLink
                label="Templates"
                active={activeView === "templates"}
                onClick={() => goTo("templates")}
              />
              <NavLink label="Jobs" active={activeView === "jobs"} onClick={() => goTo("jobs")} />

              <Divider my="xs" />

              <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="sm" pb={4}>
                Sync
              </Text>
              <NavLink
                label="Sync Tenants"
                active={activeView === "sync-tenants"}
                onClick={() => goTo("sync-tenants")}
              />
              <NavLink
                label="Sync Models"
                active={activeView === "sync-models"}
                onClick={() => goTo("sync-models")}
              />

              <Divider my="xs" />

              <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="sm" pb={4}>
                Actions
              </Text>
              <NavLink
                label="Seed Data"
                active={activeView === "seed"}
                onClick={() => goTo("seed")}
              />
              <NavLink
                label="Import Entries"
                active={activeView === "import"}
                onClick={() => goTo("import")}
              />
              <NavLink
                label="Cleanup Seeded Data"
                disabled={isCleaningUp}
                description={isCleaningUp ? "Cleaning..." : undefined}
                onClick={() => presenter.openCleanupDialog()}
              />
              <NavLink label="Edit Project" onClick={() => presenter.openEditDialog()} />
            </Stack>
          </Paper>

          <Divider orientation="vertical" mx="md" />

          <Box style={{ flex: 1, minWidth: 0 }}>
            {activeView === "tenants" && <TenantsTab tenants={tenants} />}
            {activeView === "models" && <ModelsTab groups={groups} models={models} />}
            {activeView === "files" && (
              <FilesTab
                mergedFiles={vm.mergedFiles}
                onUploadFiles={(files) => void presenter.uploadFilesToProject(files)}
                onUploadAllGlobal={() => void presenter.uploadAllGlobalImages()}
                onDelete={(id) => void presenter.deleteFile(id)}
                isUploadingGlobal={isUploadingGlobal}
                selectedTenant={project.tenant}
              />
            )}
            {activeView === "entries" && (
              <AuditLogTab
                entries={entries}
                totalCount={vm.entriesTotalCount}
                page={vm.entriesPage}
                jobFilter={vm.entriesJobFilter}
                modelFilter={vm.entriesModelFilter}
                tenantFilter={vm.entriesTenantFilter}
                statusFilter={vm.entriesStatusFilter}
                models={vm.models}
                tenants={vm.tenants}
                isClearing={isClearingEntries}
                onPageChange={(p) => void presenter.loadEntriesPage(p)}
                onFilterChange={(k, v) => void presenter.setEntriesFilter(k, v)}
                onClearFilter={() => void presenter.clearEntriesFilter()}
                onClear={() => void presenter.clearEntries()}
              />
            )}
            {activeView === "history" && (
              <SeedHistoryTab
                seedJobs={seedJobs}
                onJobClick={(jobId) => void presenter.viewJobEntries(jobId)}
              />
            )}
            {activeView === "jobs" && (
              <JobsTab jobs={vm.jobs} onCancel={(jobId) => void presenter.cancelJob(jobId)} />
            )}
            {activeView === "templates" && (
              <TemplatesTab
                templates={templates}
                onLoad={(id) => presenter.loadTemplate(id)}
                onDelete={(id) => void presenter.deleteTemplate(id)}
              />
            )}
            {activeView === "sync-tenants" && (
              <SyncTenantsTab
                logs={syncLog}
                isSyncing={isSyncingTenants}
                onSync={() => void presenter.syncTenants()}
                onDeleteLog={(id) => void presenter.deleteSyncLog(id)}
              />
            )}
            {activeView === "sync-models" && (
              <SyncModelsTab
                logs={syncLog}
                isSyncing={isSyncingModels}
                onSync={() => void presenter.syncModels()}
                onDeleteLog={(id) => void presenter.deleteSyncLog(id)}
              />
            )}
            {activeView === "seed" && <EmbeddedSeedConfig projectId={projectId} />}
            {activeView === "import" && (
              <ImportEntriesTab
                tenants={tenants}
                models={models}
                isImporting={isImporting}
                onImport={(tenant, modelIds) => void presenter.importEntries(tenant, modelIds)}
              />
            )}
          </Box>
        </Group>
      </Stack>

      <Modal
        opened={showEditDialog}
        onClose={() => presenter.closeEditDialog()}
        title="Edit Project"
        centered
      >
        <EditProjectForm
          project={project}
          onSubmit={(input) => presenter.submitEdit(input)}
          onCancel={() => presenter.closeEditDialog()}
        />
      </Modal>

      <Modal
        opened={showCleanupDialog}
        onClose={() => presenter.closeCleanupDialog()}
        title="Cleanup Seeded Data"
        centered
      >
        <Text>
          Delete all seeded entries from Webiny? This removes entries created by this tool from the
          target CMS instance. Entries are deleted in reverse dependency order.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => presenter.closeCleanupDialog()}>
            Cancel
          </Button>
          <Button color="red" onClick={() => void presenter.confirmCleanup()}>
            Delete All Seeded Entries
          </Button>
        </Group>
      </Modal>
    </>
  );
});

const HEALTH_CONFIG: Record<string, { color: string; label: string }> = {
  unknown: { color: "gray", label: "Not checked" },
  checking: { color: "blue", label: "Checking..." },
  reachable: { color: "green", label: "Online" },
  unreachable: { color: "red", label: "Unreachable" },
};

interface HealthBadgeProps {
  status: string;
  error: string | null;
  onCheck: () => void;
}

function HealthBadge({ status, error, onCheck }: HealthBadgeProps) {
  const config = HEALTH_CONFIG[status] ?? HEALTH_CONFIG.unknown;
  const badge = (
    <Badge
      color={config.color}
      variant="dot"
      size="sm"
      style={{ cursor: "pointer" }}
      onClick={onCheck}
    >
      {config.label}
    </Badge>
  );

  if (error) {
    return <Tooltip label={error}>{badge}</Tooltip>;
  }

  return badge;
}

function EmbeddedSeedConfig({ projectId }: { projectId: string }) {
  const { presenter } = useFeature(SeedConfigPresentationFeature);
  return <SeedConfigPage presenter={presenter} projectId={projectId} />;
}
