import { observer } from "mobx-react-lite";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";

interface TemplatesTabProps {
  templates: ProjectDetailPresenter.VM["templates"];
  onLoad: (templateId: string) => void;
  onDelete: (templateId: string) => void;
}

export const TemplatesTab = observer(function TemplatesTab({
  templates,
  onLoad,
  onDelete,
}: TemplatesTabProps) {
  if (templates.length === 0) {
    return (
      <Text c="dimmed" fs="italic">
        No saved templates. Templates are created when you save a seed configuration.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {templates.map((template) => (
        <Card key={template.id} withBorder padding="sm">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={500}>{template.name}</Text>
              <Group gap="xs">
                <Badge size="xs" variant="outline">
                  {template.config.tenant}
                </Badge>
                <Text size="xs" c="dimmed">
                  {template.config.models.length} models,{" "}
                  {template.config.models.reduce((sum, m) => sum + m.amount, 0)} total entries
                </Text>
              </Group>
            </Stack>
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={() => onLoad(template.id)}>
                Load
              </Button>
              <Button size="xs" variant="subtle" color="red" onClick={() => onDelete(template.id)}>
                Delete
              </Button>
            </Group>
          </Group>
        </Card>
      ))}
    </Stack>
  );
});
