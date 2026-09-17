import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Accordion, Badge, Group, Pagination, Stack, Text } from "@mantine/core";
import { CodeViewerModal } from "~/ui/components/CodeViewerModal.js";
import { usePagination } from "~/ui/components/usePagination.js";
import { useFeature } from "~/ui/di/useFeature.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import type { IModelVM } from "../abstractions/ModelsTabPresenter.js";
import { ModelsTabFeature } from "../feature.js";

interface ModelsTabProps {
  context: ProjectDetailTabContext;
}

export const ModelsTab = observer(function ModelsTab({ context }: ModelsTabProps) {
  const { presenter } = useFeature(ModelsTabFeature);
  const projectId = context.projectId;
  const environmentId = context.ref?.environmentId ?? null;

  /**
   * The component is what knows the tab is on screen, so it is what asks for the data. The
   * environment is a dependency as well as the project: the shell resolves it asynchronously, so
   * on a first visit this runs once without one, reads nothing, and runs again when it arrives.
   */
  useEffect(() => {
    void presenter.activate(context);
    return () => presenter.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenter, projectId, environmentId]);

  const [selectedModel, setSelectedModel] = useState<IModelVM | null>(null);
  const vm = presenter.vm;
  const { page, totalPages, pageItems: pageGroups, setPage } = usePagination(vm.groups);

  if (vm.models.length === 0) {
    return (
      <Text c="dimmed" fs="italic">
        No models synced. Click &quot;Sync All&quot; to fetch them from Webiny.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Accordion variant="separated">
        {pageGroups.map((group) => {
          const groupModels = vm.models.filter((model) => model.groupSlug === group.slug);
          return (
            <Accordion.Item key={group.slug} value={group.slug}>
              <Accordion.Control>
                <Group gap="sm">
                  <Text fw={600}>{group.name}</Text>
                  <Badge size="sm" variant="light">
                    {groupModels.length} models
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  {groupModels.map((model) => (
                    <ModelItem key={model.modelId} model={model} onSelect={setSelectedModel} />
                  ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}
      {selectedModel && (
        <CodeViewerModal
          opened={true}
          onClose={() => setSelectedModel(null)}
          title={selectedModel.name}
          value={JSON.stringify(selectedModel, null, 2)}
          language="json"
        />
      )}
    </Stack>
  );
});

interface ModelItemProps {
  model: IModelVM;
  onSelect: (model: IModelVM) => void;
}

function ModelItem({ model, onSelect }: ModelItemProps) {
  return (
    <Group
      justify="space-between"
      p="xs"
      onClick={() => onSelect(model)}
      style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", cursor: "pointer" }}
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
