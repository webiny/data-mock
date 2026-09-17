import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Badge, Button, Card, Group, Pagination, Stack, Text } from "@mantine/core";
import { usePagination } from "~/ui/components/usePagination.js";
import { useFeature } from "~/ui/di/useFeature.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { TemplatesTabFeature } from "../feature.js";

interface TemplatesTabProps {
  context: ProjectDetailTabContext;
}

export const TemplatesTab = observer(function TemplatesTab({ context }: TemplatesTabProps) {
  const { presenter } = useFeature(TemplatesTabFeature);
  const projectId = context.projectId;
  const environmentId = context.ref?.environmentId ?? null;

  /**
   * The component is what knows the tab is on screen, so it is what asks for the data. Templates
   * are project-scoped, so the presenter reads as soon as `projectId` is known — the environment
   * dependency below only re-runs the effect, it does not gate the read.
   */
  useEffect(() => {
    void presenter.activate(context);
    return () => presenter.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenter, projectId, environmentId]);

  const vm = presenter.vm;
  const { page, totalPages, pageItems, setPage } = usePagination(vm.templates);

  if (vm.templates.length === 0) {
    return (
      <Text c="dimmed" fs="italic">
        No saved templates. Templates are created when you save a seed configuration.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {pageItems.map((template) => (
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
                  {template.config.models.reduce((sum, model) => sum + model.amount, 0)} total
                  entries
                </Text>
              </Group>
            </Stack>
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={() => presenter.loadTemplate(template.id)}>
                Load
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => void presenter.deleteTemplate(template.id)}
              >
                Delete
              </Button>
            </Group>
          </Group>
        </Card>
      ))}
      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}
    </Stack>
  );
});
