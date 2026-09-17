import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Badge, Button, Group, Pagination, Select, Stack, Table, Text } from "@mantine/core";
import { CodeViewerModal } from "~/ui/components/CodeViewerModal.js";
import { ConfirmDialog } from "~/ui/components/ConfirmDialog.js";
import { useFeature } from "~/ui/di/useFeature.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import type { IEntryVM } from "../abstractions/EntriesTabPresenter.js";
import { EntriesTabFeature } from "../feature.js";

const PAGE_SIZE = 25;

const statusColor: Record<string, string> = {
  created: "green",
  failed: "red",
  "dry-run": "yellow",
  imported: "blue",
  deleted: "orange",
};

const STATUS_OPTIONS = [
  { value: "created", label: "Created" },
  { value: "failed", label: "Failed" },
  { value: "dry-run", label: "Dry Run" },
  { value: "imported", label: "Imported" },
  { value: "deleted", label: "Deleted" },
];

function buildEntryDetail(entry: IEntryVM): string {
  const sections: string[] = [];

  if (entry.error) {
    sections.push(`// ERROR\n${JSON.stringify(entry.error, null, 2)}`);
  }

  if (entry.requestData) {
    sections.push(`// REQUEST\n${JSON.stringify(entry.requestData, null, 2)}`);
  }

  if (entry.responseData) {
    try {
      const parsed = JSON.parse(entry.responseData);
      sections.push(`// RESPONSE\n${JSON.stringify(parsed, null, 2)}`);
    } catch {
      sections.push(`// RESPONSE\n${entry.responseData}`);
    }
  }

  sections.push(`// ENTRY DATA\n${JSON.stringify(entry.entryData, null, 2)}`);

  return sections.join("\n\n");
}

interface EntriesTabProps {
  context: ProjectDetailTabContext;
}

export const EntriesTab = observer(function EntriesTab({ context }: EntriesTabProps) {
  const { presenter } = useFeature(EntriesTabFeature);
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

  const [selectedEntry, setSelectedEntry] = useState<IEntryVM | null>(null);
  const vm = presenter.vm;
  const totalPages = Math.max(1, Math.ceil(vm.entriesTotalCount / PAGE_SIZE));

  const hasFilters =
    vm.entriesJobFilter ||
    vm.entriesModelFilter ||
    vm.entriesTenantFilter ||
    vm.entriesStatusFilter;

  const modelOptions = vm.models.map((model) => ({ value: model.modelId, label: model.name }));
  const tenantOptions = vm.tenants.map((tenant) => ({
    value: tenant.tenantId,
    label: tenant.name,
  }));

  return (
    <Stack gap="md">
      {vm.entriesJobFilter && (
        <Group gap="xs">
          <Badge variant="light" size="sm">
            Filtered by job: {vm.entriesJobFilter.slice(0, 8)}...
          </Badge>
          <Button variant="subtle" size="compact-xs" onClick={() => presenter.clearEntriesFilter()}>
            Show all
          </Button>
        </Group>
      )}

      <Group gap="xs">
        <Select
          placeholder="Model"
          data={modelOptions}
          value={vm.entriesModelFilter}
          onChange={(value) => presenter.setEntriesFilter("modelId", value)}
          clearable
          size="xs"
          w={180}
        />
        <Select
          placeholder="Tenant"
          data={tenantOptions}
          value={vm.entriesTenantFilter}
          onChange={(value) => presenter.setEntriesFilter("tenant", value)}
          clearable
          size="xs"
          w={150}
        />
        <Select
          placeholder="Status"
          data={STATUS_OPTIONS}
          value={vm.entriesStatusFilter}
          onChange={(value) => presenter.setEntriesFilter("status", value)}
          clearable
          size="xs"
          w={130}
        />
        {hasFilters && (
          <Button variant="subtle" size="compact-xs" onClick={() => presenter.clearEntriesFilter()}>
            Clear filters
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Text size="sm" c="dimmed">
          {vm.entriesTotalCount} entries
        </Text>
        <Button
          variant="subtle"
          color="red"
          size="compact-xs"
          loading={vm.isClearingEntries}
          onClick={() => presenter.clearEntries()}
        >
          Clear All
        </Button>
      </Group>

      {vm.entries.length === 0 ? (
        <Text c="dimmed" ta="center" mt="xl">
          {hasFilters ? "No entries match the current filters." : "No seed entries yet."}
        </Text>
      ) : (
        <>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Model</Table.Th>
                <Table.Th>Tenant</Table.Th>
                <Table.Th>Entry ID</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {vm.entries.map((entry) => (
                <Table.Tr
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  style={{ cursor: "pointer" }}
                >
                  <Table.Td>
                    <Text size="sm">{new Date(entry.createdAt).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {entry.modelId}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="outline" size="sm">
                      {entry.tenant}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {entry.entryId}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor[entry.status] ?? "gray"} size="sm">
                      {entry.status}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination
                total={totalPages}
                value={vm.entriesPage}
                onChange={(page) => presenter.loadEntriesPage(page)}
              />
            </Group>
          )}
        </>
      )}

      {selectedEntry && (
        <CodeViewerModal
          opened={true}
          onClose={() => setSelectedEntry(null)}
          title={`Entry ${selectedEntry.entryId || "(no ID)"} — ${selectedEntry.modelId} [${selectedEntry.status}]`}
          value={buildEntryDetail(selectedEntry)}
          language="json"
        />
      )}

      <ConfirmDialog
        vm={vm.clearConfirmation}
        onConfirm={() => void presenter.confirmClearEntries()}
        onCancel={() => presenter.cancelClearEntries()}
      />
    </Stack>
  );
});
