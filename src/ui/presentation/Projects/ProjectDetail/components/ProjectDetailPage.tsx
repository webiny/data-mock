import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Badge, Button, Group, Loader, Stack, Tabs, Text, Title } from "@mantine/core";
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

      <Tabs value={activeTab} onChange={(tab) => presenter.setTab(tab ?? "tenants")}>
        <Tabs.List>
          <Tabs.Tab value="tenants">Tenants ({tenants.length})</Tabs.Tab>
          <Tabs.Tab value="models">Models & Groups ({models.length})</Tabs.Tab>
          <Tabs.Tab value="history">Seed History ({seedJobs.length})</Tabs.Tab>
          <Tabs.Tab value="templates">Templates ({templates.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="tenants" pt="md">
          <TenantsTab tenants={tenants} />
        </Tabs.Panel>

        <Tabs.Panel value="models" pt="md">
          <ModelsTab groups={groups} models={models} />
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <SeedHistoryTab seedJobs={seedJobs} />
        </Tabs.Panel>

        <Tabs.Panel value="templates" pt="md">
          <TemplatesTab
            templates={templates}
            onLoad={(id) => presenter.loadTemplate(id)}
            onDelete={(id) => void presenter.deleteTemplate(id)}
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
});
