import { observer } from "mobx-react-lite";
import { Accordion, Badge, Group, Stack, Text } from "@mantine/core";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";

interface ModelsTabProps {
  groups: ProjectDetailPresenter.VM["groups"];
  models: ProjectDetailPresenter.VM["models"];
}

export const ModelsTab = observer(function ModelsTab({ groups, models }: ModelsTabProps) {
  if (models.length === 0) {
    return (
      <Text c="dimmed" fs="italic">
        No models synced. Click &quot;Sync All&quot; to fetch them from Webiny.
      </Text>
    );
  }

  if (groups.length === 0) {
    return (
      <Stack gap="xs">
        {models.map((m) => (
          <ModelItem key={m.modelId} model={m} />
        ))}
      </Stack>
    );
  }

  return (
    <Accordion variant="separated">
      {groups.map((group) => {
        const groupModels = models.filter((m) => m.groupSlug === group.slug);
        return (
          <Accordion.Item key={group.slug} value={group.slug}>
            <Accordion.Control>
              <Group gap="sm">
                <Text fw={600}>{group.name}</Text>
                <Badge size="sm" variant="light">
                  {group.modelCount} models
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {groupModels.map((m) => (
                  <ModelItem key={m.modelId} model={m} />
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
});

function ModelItem({ model }: { model: ModelsTabProps["models"][number] }) {
  return (
    <Group
      justify="space-between"
      p="xs"
      style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}
    >
      <Group gap="sm">
        <Text size="sm" fw={500}>
          {model.name}
        </Text>
        <Text size="xs" c="dimmed">
          {model.modelId}
        </Text>
      </Group>
      <Group gap="xs">
        <Badge size="xs" variant="outline">
          {model.fieldCount} fields
        </Badge>
        {model.syncedAt && (
          <Text size="xs" c="dimmed">
            Synced {new Date(model.syncedAt).toLocaleDateString()}
          </Text>
        )}
      </Group>
    </Group>
  );
}
