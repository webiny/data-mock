import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
  Select,
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
import { EnvironmentsTab } from "./EnvironmentsTab.js";
import { SystemInfoTab } from "./SystemInfoTab.js";
import { TenantsTab } from "./TenantsTab.js";
import { ModelsTab } from "./ModelsTab.js";
import { SeedHistoryTab } from "./SeedHistoryTab.js";
import { TemplatesTab } from "./TemplatesTab.js";
import { FilesTab } from "./FilesTab.js";
import { AuditLogTab } from "./AuditLogTab.js";
import { SyncTenantsTab } from "./SyncTenantsTab.js";
import { SyncModelsTab } from "./SyncModelsTab.js";
import { PullImagesTab } from "./PullImagesTab.js";
import { SyncLogTable } from "./SyncLogTable.js";
import { ImportEntriesTab } from "./ImportEntriesTab.js";
import { JobsTab } from "./JobsTab.js";
import { EditProjectForm } from "./EditProjectForm.js";
import { navigate } from "~/ui/features/router/Router.js";
import type { EnvironmentRef } from "~/shared/types.js";
import { AppRoutes } from "~/ui/features/router/routePaths.js";

interface ProjectDetailPageProps {
  presenter: ProjectDetailPresenter.Interface;
  projectId: string;
  /** Stack name from the URL, or null when the URL addresses no specific environment. */
  envName: string | null;
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
  envName,
  subPath,
}: ProjectDetailPageProps) {
  const activeView = resolveView(subPath);

  useEffect(() => {
    void presenter.load(projectId, envName);
    return () => presenter.dispose();
  }, [presenter, projectId, envName]);

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
    const stackName = vm.currentEnvironment?.stackName;
    if (stackName) {
      navigate(AppRoutes.environmentTab(projectId, stackName, tab));
      return;
    }
    // No environment resolved yet — keep the bare project URL, which resolves to the first one.
    navigate(AppRoutes.projectTab(projectId, tab));
  };

  return (
    <>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="sm">
              <Title order={2}>{project.name}</Title>
              <Badge variant="light">
                {project.webinyVersion ? `v${project.webinyVersion}` : "workspace root"}
              </Badge>
              {vm.showEnvironmentSelector && (
                <Select
                  size="xs"
                  w={180}
                  aria-label="Environment"
                  value={vm.currentEnvironment?.stackName ?? null}
                  data={vm.environments.map((environment) => ({
                    value: environment.stackName,
                    label: environment.deployed
                      ? environment.stackName
                      : `${environment.stackName} (not deployed)`,
                  }))}
                  onChange={(value) => {
                    if (value) {
                      navigate(AppRoutes.environmentTab(projectId, value, activeView));
                    }
                  }}
                />
              )}
              <HealthBadge
                status={vm.projectHealth}
                error={vm.projectHealthError}
                onCheck={() => void presenter.checkHealth()}
              />
            </Group>
            <Text size="sm" c="dimmed">
              {vm.currentEnvironment?.apiUrl ?? project.rootPath ?? "no local checkout"}
            </Text>
            {vm.environmentError && (
              <Text size="sm" c="orange">
                {vm.environmentError}
              </Text>
            )}
            {vm.currentEnvironment && !vm.currentEnvironment.connectable && (
              <Text size="xs" c="orange">
                Partially deployed — the api app is not deployed, so this environment cannot be
                seeded.
              </Text>
            )}
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                Tenant:
              </Text>
              <Badge size="xs" variant="outline">
                {vm.currentEnvironment?.tenant ?? "root"}
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
                System
              </Text>
              <NavLink
                label="Environments"
                active={activeView === "environments"}
                onClick={() => goTo("environments")}
              />
              <NavLink
                label="System Info"
                active={activeView === "system"}
                onClick={() => goTo("system")}
              />

              <Divider my="xs" />

              <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="sm" pb={4}>
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
              {/* Templates hidden — not needed currently */}
              <NavLink label="Jobs" active={activeView === "jobs"} onClick={() => goTo("jobs")} />
              <NavLink
                label="Activity Log"
                active={activeView === "activity"}
                onClick={() => goTo("activity")}
              />

              <Divider my="xs" />

              <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="sm" pb={4}>
                Pull
              </Text>
              <NavLink
                label="Pull Tenants"
                active={activeView === "pull-tenants"}
                onClick={() => goTo("pull-tenants")}
              />
              <NavLink
                label="Pull Models"
                active={activeView === "pull-models"}
                onClick={() => goTo("pull-models")}
              />
              <NavLink
                label="Pull Images"
                active={activeView === "pull-images"}
                onClick={() => goTo("pull-images")}
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
              <NavLink
                label="Sync from disk"
                description={vm.isSyncing ? "Starting..." : undefined}
                disabled={vm.isSyncing || project.rootPath === null}
                onClick={() => void presenter.syncProject()}
              />
              <NavLink label="Edit Project" onClick={() => presenter.openEditDialog()} />
            </Stack>
          </Paper>

          <Divider orientation="vertical" mx="md" />

          <Box style={{ flex: 1, minWidth: 0 }}>
            {activeView === "environments" && (
              <EnvironmentsTab
                environments={vm.environments}
                archivedEnvironments={vm.archivedEnvironments}
                currentEnvironment={vm.currentEnvironment}
                stacks={vm.stacks}
                isSyncing={vm.isSyncing}
                confirmation={vm.environmentDeleteConfirmation}
                onSync={() => void presenter.syncProject()}
                onSelectEnvironment={(stackName) =>
                  navigate(AppRoutes.environmentTab(projectId, stackName, "environments"))
                }
                onConfirmRemove={(id, stackName) =>
                  presenter.confirmRemoveEnvironment(id, stackName)
                }
                onCancelRemove={() => presenter.cancelRemoveEnvironment()}
                onRequestPurge={() => presenter.requestPurgeEnvironment()}
                onArchive={() => void presenter.archiveEnvironment()}
                onPurge={() => void presenter.purgeEnvironment()}
                onRestore={(id) => void presenter.restoreEnvironment(id)}
              />
            )}
            {activeView === "system" && (
              <SystemInfoTab sections={vm.systemInfo} notice={vm.systemInfoNotice} />
            )}
            {activeView === "tenants" && <TenantsTab tenants={tenants} />}
            {activeView === "models" && <ModelsTab groups={groups} models={models} />}
            {activeView === "files" && (
              <FilesTab
                mergedFiles={vm.mergedFiles}
                onUploadFiles={(files) => void presenter.uploadFilesToProject(files)}
                onUploadAllGlobal={() => void presenter.uploadAllGlobalImages()}
                onUploadSelected={(names) => void presenter.uploadSelectedGlobalImages(names)}
                onPullFiles={() => void presenter.pullFiles()}
                onDelete={(id) => void presenter.deleteFile(id)}
                isUploadingGlobal={isUploadingGlobal}
                isPullingFiles={vm.isPullingFiles}
                selectedTenant={vm.currentEnvironment?.tenant ?? "root"}
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
                totalCount={vm.seedJobsTotalCount}
                page={vm.seedJobsPage}
                statusFilter={vm.seedJobsStatusFilter}
                onPageChange={(p) => presenter.loadSeedJobsPage(p)}
                onFilterChange={(k, v) => presenter.setSeedJobsFilter(k, v)}
                onClearFilter={() => presenter.clearSeedJobsFilter()}
                onJobClick={(jobId) => void presenter.viewJobEntries(jobId)}
              />
            )}
            {activeView === "jobs" && (
              <JobsTab
                jobs={vm.jobs}
                totalCount={vm.jobsTotalCount}
                page={vm.jobsPage}
                typeFilter={vm.jobsTypeFilter}
                statusFilter={vm.jobsStatusFilter}
                onPageChange={(p) => presenter.loadJobsPage(p)}
                onFilterChange={(k, v) => presenter.setJobsFilter(k, v)}
                onClearFilter={() => presenter.clearJobsFilter()}
                onCancel={(jobId) => void presenter.cancelJob(jobId)}
              />
            )}
            {activeView === "activity" && (
              <SyncLogTable
                logs={syncLog}
                totalCount={vm.syncLogsTotalCount}
                page={vm.syncLogsPage}
                typeFilter={vm.syncLogsTypeFilter}
                statusFilter={vm.syncLogsStatusFilter}
                onPageChange={(p) => presenter.loadSyncLogsPage(p)}
                onFilterChange={(k, v) => presenter.setSyncLogsFilter(k, v)}
                onClearFilter={() => presenter.clearSyncLogsFilter()}
                onDelete={(id) => void presenter.deleteSyncLog(id)}
              />
            )}
            {activeView === "templates" && (
              <TemplatesTab
                templates={templates}
                onLoad={(id) => presenter.loadTemplate(id)}
                onDelete={(id) => void presenter.deleteTemplate(id)}
              />
            )}
            {activeView === "pull-tenants" && (
              <SyncTenantsTab
                logs={syncLog}
                isSyncing={isSyncingTenants}
                onSync={() => void presenter.pullTenants()}
                onDeleteLog={(id) => void presenter.deleteSyncLog(id)}
              />
            )}
            {activeView === "pull-models" && (
              <SyncModelsTab
                logs={syncLog}
                isSyncing={isSyncingModels}
                onSync={() => void presenter.pullModels()}
                onDeleteLog={(id) => void presenter.deleteSyncLog(id)}
              />
            )}
            {activeView === "pull-images" && (
              <PullImagesTab
                logs={syncLog}
                isPulling={vm.isPullingFiles}
                onPull={() => void presenter.pullFiles()}
                onDeleteLog={(id) => void presenter.deleteSyncLog(id)}
              />
            )}
            {activeView === "seed" && vm.currentEnvironment && (
              <EmbeddedSeedConfig envRef={{ projectId, environmentId: vm.currentEnvironment.id }} />
            )}
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

function EmbeddedSeedConfig({ envRef }: { envRef: EnvironmentRef }) {
  const { presenter } = useFeature(SeedConfigPresentationFeature);
  return <SeedConfigPage presenter={presenter} envRef={envRef} />;
}
