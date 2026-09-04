import { observer } from "mobx-react-lite";
import { Badge, Button, Group, Pagination, Select, Stack, Table, Text } from "@mantine/core";
import type { ISeedJobVM } from "../abstractions/ProjectDetailPresenter.js";

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "dry-run", label: "Dry Run" },
];

function statusColor(status: string): string {
  switch (status) {
    case "completed":
      return "green";
    case "failed":
      return "red";
    case "running":
      return "blue";
    case "dry-run":
      return "yellow";
    default:
      return "gray";
  }
}

interface SeedHistoryTabProps {
  seedJobs: ISeedJobVM[];
  totalCount: number;
  page: number;
  statusFilter: string | null;
  onPageChange: (page: number) => void;
  onFilterChange: (key: string, value: string | null) => void;
  onClearFilter: () => void;
  onJobClick: (jobId: string) => void;
}

export const SeedHistoryTab = observer(function SeedHistoryTab({
  seedJobs,
  totalCount,
  page,
  statusFilter,
  onPageChange,
  onFilterChange,
  onClearFilter,
  onJobClick,
}: SeedHistoryTabProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <Stack gap="md">
      <Group gap="xs">
        <Select
          placeholder="Status"
          data={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(v) => onFilterChange("seedStatus", v)}
          clearable
          size="xs"
          w={140}
        />
        {statusFilter && (
          <Button variant="subtle" size="compact-xs" onClick={onClearFilter}>
            Clear filters
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Text size="sm" c="dimmed">
          {totalCount} seed job{totalCount === 1 ? "" : "s"}
        </Text>
      </Group>

      {seedJobs.length === 0 ? (
        <Text c="dimmed" ta="center" mt="xl">
          {statusFilter
            ? "No seed jobs match the current filter."
            : 'No seed jobs yet. Use "Seed Data" to generate mock entries.'}
        </Text>
      ) : (
        <>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Models</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th>Errors</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {seedJobs.map((job) => (
                <Table.Tr
                  key={job.id}
                  onClick={() => onJobClick(job.id)}
                  style={{ cursor: "pointer" }}
                >
                  <Table.Td>
                    <Text size="sm">{new Date(job.createdAt).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{job.modelCount}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {job.entriesCreated}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {job.errorCount > 0 ? (
                      <Text size="sm" c="red" fw={500}>
                        {job.errorCount}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">
                        0
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor(job.status)} size="sm">
                      {job.status}
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
    </Stack>
  );
});
