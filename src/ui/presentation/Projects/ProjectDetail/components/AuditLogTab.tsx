import { useState } from "react";
import { Badge, Button, Group, Modal, Pagination, Select, Stack, Table, Text } from "@mantine/core";
import { CodeViewerModal } from "~/ui/components/CodeViewerModal.js";
import type { IEntryVM, IModelVM, ITenantVM } from "../abstractions/ProjectDetailPresenter.js";

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

interface AuditLogTabProps {
  entries: IEntryVM[];
  totalCount: number;
  page: number;
  jobFilter: string | null;
  modelFilter: string | null;
  tenantFilter: string | null;
  statusFilter: string | null;
  models: IModelVM[];
  tenants: ITenantVM[];
  isClearing: boolean;
  onPageChange: (page: number) => void;
  onFilterChange: (key: string, value: string | null) => void;
  onClearFilter: () => void;
  onClear: () => void;
}

export function AuditLogTab({
  entries,
  totalCount,
  page,
  jobFilter,
  modelFilter,
  tenantFilter,
  statusFilter,
  models,
  tenants,
  isClearing,
  onPageChange,
  onFilterChange,
  onClearFilter,
  onClear,
}: AuditLogTabProps) {
  const [selectedEntry, setSelectedEntry] = useState<IEntryVM | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const hasFilters = jobFilter || modelFilter || tenantFilter || statusFilter;

  const modelOptions = models.map((m) => ({ value: m.modelId, label: m.name }));
  const tenantOptions = tenants.map((t) => ({ value: t.tenantId, label: t.name }));

  return (
    <Stack gap="md">
      {jobFilter && (
        <Group gap="xs">
          <Badge variant="light" size="sm">
            Filtered by job: {jobFilter.slice(0, 8)}...
          </Badge>
          <Button variant="subtle" size="compact-xs" onClick={onClearFilter}>
            Show all
          </Button>
        </Group>
      )}

      <Group gap="xs">
        <Select
          placeholder="Model"
          data={modelOptions}
          value={modelFilter}
          onChange={(v) => onFilterChange("modelId", v)}
          clearable
          size="xs"
          w={180}
        />
        <Select
          placeholder="Tenant"
          data={tenantOptions}
          value={tenantFilter}
          onChange={(v) => onFilterChange("tenant", v)}
          clearable
          size="xs"
          w={150}
        />
        <Select
          placeholder="Status"
          data={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(v) => onFilterChange("status", v)}
          clearable
          size="xs"
          w={130}
        />
        {hasFilters && (
          <Button variant="subtle" size="compact-xs" onClick={onClearFilter}>
            Clear filters
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Text size="sm" c="dimmed">
          {totalCount} entries
        </Text>
        <Button
          variant="subtle"
          color="red"
          size="compact-xs"
          loading={isClearing}
          onClick={() => setShowClearConfirm(true)}
        >
          Clear All
        </Button>
      </Group>

      {entries.length === 0 ? (
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
              {entries.map((entry) => (
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
              <Pagination total={totalPages} value={page} onChange={onPageChange} />
            </Group>
          )}
        </>
      )}

      {selectedEntry && (
        <CodeViewerModal
          opened={true}
          onClose={() => setSelectedEntry(null)}
          title={`Entry ${selectedEntry.entryId} — ${selectedEntry.modelId}`}
          value={JSON.stringify(selectedEntry.entryData, null, 2)}
          language="json"
        />
      )}

      <Modal
        opened={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear Audit Log"
        centered
        size="sm"
      >
        <Text>Delete all audit log entries for this project?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setShowClearConfirm(false)}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              setShowClearConfirm(false);
              onClear();
            }}
          >
            Clear All
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
