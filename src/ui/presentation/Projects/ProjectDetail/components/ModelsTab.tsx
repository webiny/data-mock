import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Accordion, Badge, Group, Pagination, Stack, Text, Title } from "@mantine/core";
import { CodeViewerModal } from "~/ui/components/CodeViewerModal.js";
import { usePagination } from "~/ui/components/usePagination.js";
import type { IGroupVM, IModelVM } from "../abstractions/ProjectDetailPresenter.js";

interface ModelsTabProps {
  groups: IGroupVM[];
  models: IModelVM[];
}

export const ModelsTab = observer(function ModelsTab({ groups, models }: ModelsTabProps) {
  const [selectedModel, setSelectedModel] = useState<IModelVM | null>(null);
  const { page, totalPages, pageItems: pageGroups, setPage } = usePagination(groups);

  if (models.length === 0) {
    return (
      <Text c="dimmed" fs="italic">
        No models synced. Click &quot;Sync All&quot; to fetch them from Webiny.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Title order={4}>
        {groups.length} Groups, {models.length} Models
      </Title>
      <Accordion variant="separated">
        {pageGroups.map((group) => {
          const groupModels = models.filter((m) => m.groupSlug === group.slug);
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
                  {groupModels.map((m) => (
                    <ModelItem key={m.modelId} model={m} onSelect={setSelectedModel} />
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
          title={`Fields — ${selectedModel.name}`}
          value={JSON.stringify(selectedModel.fields, null, 2)}
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
