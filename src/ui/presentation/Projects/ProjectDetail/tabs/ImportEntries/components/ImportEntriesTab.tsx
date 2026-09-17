import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Alert, Button, Card, Checkbox, Group, Modal, Select, Stack, Text } from "@mantine/core";
import { useFeature } from "~/ui/di/useFeature.js";
import { ConfirmDialog } from "~/ui/components/ConfirmDialog.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { ImportEntriesTabFeature } from "../feature.js";

interface ImportEntriesTabProps {
  context: ProjectDetailTabContext;
}

export const ImportEntriesTab = observer(function ImportEntriesTab({
  context,
}: ImportEntriesTabProps) {
  const { presenter } = useFeature(ImportEntriesTabFeature);
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

  const vm = presenter.vm;

  const [selectedTenant, setSelectedTenant] = useState(
    vm.tenants.length > 0 ? vm.tenants[0]!.tenantId : "",
  );
  const [selectedModels, setSelectedModels] = useState<Set<string>>(
    new Set(vm.models.map((model) => model.modelId)),
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
    setSelectedModels(new Set(vm.models.map((model) => model.modelId)));
  };

  const deselectAll = () => {
    setSelectedModels(new Set());
  };

  const handleImport = () => {
    presenter.importEntries(selectedTenant, Array.from(selectedModels));
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Pull existing entries from Webiny and store them locally. Imported entries can be used as
        references when seeding new data.
      </Text>

      {vm.tenants.length > 0 && (
        <Select
          label="Tenant"
          data={vm.tenants.map((tenant) => ({
            value: tenant.tenantId,
            label: `${tenant.name} (${tenant.tenantId})`,
          }))}
          value={selectedTenant}
          onChange={(value) => {
            if (value) {
              setSelectedTenant(value);
            }
          }}
        />
      )}

      {vm.models.length === 0 ? (
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
            {vm.models.map((model) => (
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
        loading={vm.isImporting}
        disabled={selectedModels.size === 0 || !selectedTenant}
        size="lg"
      >
        Import Entries ({selectedModels.size} models)
      </Button>

      <Button
        variant="outline"
        color="red"
        disabled={vm.isCleaningUp}
        onClick={() => presenter.openCleanupDialog()}
      >
        Cleanup Seeded Data
      </Button>

      <ConfirmDialog
        vm={vm.confirmation}
        onConfirm={() => void presenter.confirmImport()}
        onCancel={() => presenter.cancelImport()}
      />

      <Modal
        opened={vm.showCleanupDialog}
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
          <Button
            color="red"
            loading={vm.isCleaningUp}
            onClick={() => void presenter.confirmCleanup()}
          >
            Delete All Seeded Entries
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
});
