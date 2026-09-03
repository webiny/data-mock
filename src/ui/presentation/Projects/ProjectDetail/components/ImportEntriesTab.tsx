import { useState } from "react";
import { Alert, Button, Card, Checkbox, Group, Select, Stack, Text, Title } from "@mantine/core";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";

interface ImportEntriesTabProps {
  tenants: ProjectDetailPresenter.VM["tenants"];
  models: ProjectDetailPresenter.VM["models"];
  isImporting: boolean;
  onImport: (tenant: string, modelIds: string[]) => void;
}

export function ImportEntriesTab({
  tenants,
  models,
  isImporting,
  onImport,
}: ImportEntriesTabProps) {
  const [selectedTenant, setSelectedTenant] = useState(
    tenants.length > 0 ? tenants[0]!.tenantId : "",
  );
  const [selectedModels, setSelectedModels] = useState<Set<string>>(
    new Set(models.map((m) => m.modelId)),
  );
  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedModels(new Set(models.map((m) => m.modelId)));
  };

  const deselectAll = () => {
    setSelectedModels(new Set());
  };

  const handleImport = () => {
    onImport(selectedTenant, Array.from(selectedModels));
  };

  return (
    <Stack gap="md">
      <Title order={4}>Import Entries</Title>
      <Text size="sm" c="dimmed">
        Pull existing entries from Webiny and store them locally. Imported entries can be used as
        references when seeding new data.
      </Text>

      {tenants.length > 0 && (
        <Select
          label="Tenant"
          data={tenants.map((t) => ({
            value: t.tenantId,
            label: `${t.name} (${t.tenantId})`,
          }))}
          value={selectedTenant}
          onChange={(value) => {
            if (value) {
              setSelectedTenant(value);
            }
          }}
        />
      )}

      {models.length === 0 ? (
        <Alert color="yellow" title="No Models">
          No models synced. Sync models first.
        </Alert>
      ) : (
        <>
          <Group justify="space-between">
            <Text fw={500}>Models to import</Text>
            <Group gap="xs">
              <Button variant="subtle" size="compact-xs" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="subtle" size="compact-xs" onClick={deselectAll}>
                Deselect All
              </Button>
            </Group>
          </Group>
          <Stack gap="xs">
            {models.map((model) => (
              <Card key={model.modelId} withBorder p="sm">
                <Checkbox
                  label={model.name}
                  checked={selectedModels.has(model.modelId)}
                  onChange={() => toggleModel(model.modelId)}
                />
              </Card>
            ))}
          </Stack>
        </>
      )}

      <Button
        onClick={handleImport}
        loading={isImporting}
        disabled={selectedModels.size === 0 || !selectedTenant}
        size="lg"
      >
        Import Entries ({selectedModels.size} models)
      </Button>
    </Stack>
  );
}
