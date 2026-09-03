import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Stack, Text, Table, Badge, Loader } from "@mantine/core";
import type { SeedHistoryPresenter } from "../abstractions/SeedHistoryPresenter.js";

interface SeedHistoryPageProps {
  presenter: SeedHistoryPresenter.Interface;
  projectId: string;
}

function statusColor(status: string): string {
  switch (status) {
    case "completed":
      return "green";
    case "failed":
      return "red";
    case "running":
      return "blue";
    default:
      return "gray";
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export const SeedHistoryPage = observer(function SeedHistoryPage({
  presenter,
  projectId,
}: SeedHistoryPageProps) {
  useEffect(() => {
    void presenter.load(projectId);
  }, [presenter, projectId]);

  const { vm } = presenter;

  if (vm.isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
        <Text>Loading seed history...</Text>
      </Stack>
    );
  }

  if (vm.isEmpty) {
    return (
      <Stack py="md">
        <Text c="dimmed">No seed jobs yet for this project.</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Status</Table.Th>
            <Table.Th>Models</Table.Th>
            <Table.Th>Created</Table.Th>
            <Table.Th>Errors</Table.Th>
            <Table.Th>Date</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {vm.jobs.map((job) => (
            <Table.Tr key={job.id}>
              <Table.Td>
                <Badge color={statusColor(job.status)}>{job.status}</Badge>
              </Table.Td>
              <Table.Td>{job.modelCount}</Table.Td>
              <Table.Td>{job.created}</Table.Td>
              <Table.Td>
                {job.errors > 0 ? (
                  <Badge color="red">{job.errors}</Badge>
                ) : (
                  <Text size="sm" c="dimmed">
                    0
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{formatDate(job.createdAt)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
});
