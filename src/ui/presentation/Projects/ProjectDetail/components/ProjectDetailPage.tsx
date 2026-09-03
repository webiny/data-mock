import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  NavLink,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import { TenantsTab } from "./TenantsTab.js";
import { ModelsTab } from "./ModelsTab.js";
import { SeedHistoryTab } from "./SeedHistoryTab.js";
import { TemplatesTab } from "./TemplatesTab.js";

interface ProjectDetailPageProps {
  presenter: ProjectDetailPresenter.Interface;
  projectId: string;
}

export const ProjectDetailPage = observer(function ProjectDetailPage({
  presenter,
  projectId,
}: ProjectDetailPageProps) {
  useEffect(() => {
    void presenter.load(projectId);
  }, [presenter, projectId]);

  const { project, tenants, groups, models, seedJobs, templates, isLoading, activeTab, isSyncing } =
    presenter.vm;

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

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="sm">
            <Title order={2}>{project.name}</Title>
            <Badge variant="light">v{project.webinyVersion}</Badge>
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
        <Group gap="xs">
          <Button variant="filled" onClick={() => presenter.seedProject()}>
            Seed Data
          </Button>
          <Button variant="light" loading={isSyncing} onClick={() => void presenter.syncAll()}>
            Sync All
          </Button>
        </Group>
      </Group>

      <Group align="flex-start" gap={0} wrap="nowrap" style={{ width: "100%" }}>
        <Paper w={250} maw={250} p="xs" withBorder style={{ flexShrink: 0, alignSelf: "stretch" }}>
          <Stack gap={2}>
            <NavLink
              label={`Tenants (${tenants.length})`}
              active={activeTab === "tenants"}
              onClick={() => presenter.setTab("tenants")}
            />
            <NavLink
              label={`Models & Groups (${models.length})`}
              active={activeTab === "models"}
              onClick={() => presenter.setTab("models")}
            />
            <NavLink
              label={`Seed History (${seedJobs.length})`}
              active={activeTab === "history"}
              onClick={() => presenter.setTab("history")}
            />
            <NavLink
              label={`Templates (${templates.length})`}
              active={activeTab === "templates"}
              onClick={() => presenter.setTab("templates")}
            />
          </Stack>
        </Paper>

        <Divider orientation="vertical" mx="md" />

        <Box style={{ flex: 1, minWidth: 0 }}>
          {activeTab === "tenants" && <TenantsTab tenants={tenants} />}
          {activeTab === "models" && <ModelsTab groups={groups} models={models} />}
          {activeTab === "history" && <SeedHistoryTab seedJobs={seedJobs} />}
          {activeTab === "templates" && (
            <TemplatesTab
              templates={templates}
              onLoad={(id) => presenter.loadTemplate(id)}
              onDelete={(id) => void presenter.deleteTemplate(id)}
            />
          )}
        </Box>
      </Group>
    </Stack>
  );
});
