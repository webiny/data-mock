import { observer } from "mobx-react-lite";
import { Badge, Group, Pagination, Stack, Table, Text, Title } from "@mantine/core";
import { usePagination } from "~/ui/components/usePagination.js";
import type { ISeedJobVM } from "../abstractions/ProjectDetailPresenter.js";

interface SeedHistoryTabProps {
  seedJobs: ISeedJobVM[];
}

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

export const SeedHistoryTab = observer(function SeedHistoryTab({ seedJobs }: SeedHistoryTabProps) {
  const { page, totalPages, pageItems, setPage } = usePagination(seedJobs);

  if (seedJobs.length === 0) {
    return (
      <Text c="dimmed" fs="italic">
        No seed jobs yet. Use &quot;Seed Data&quot; to generate mock entries.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Title order={4}>Seed History ({seedJobs.length})</Title>
      <Table>
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
          {pageItems.map((job) => (
            <Table.Tr key={job.id}>
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
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}
    </Stack>
  );
});
