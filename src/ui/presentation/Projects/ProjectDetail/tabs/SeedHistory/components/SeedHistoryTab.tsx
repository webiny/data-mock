import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Badge, Button, Group, Pagination, Select, Stack, Table, Text } from "@mantine/core";
import { ConfirmDialog } from "~/ui/components/ConfirmDialog.js";
import { useFeature } from "~/ui/di/useFeature.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { SeedHistoryTabFeature } from "../feature.js";

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "dry-run", label: "Dry Run" },
];

function statusColor(status: string): string {
  switch (status) {
    case "completed":
      return "green";
    case "failed":
      return "red";
    case "cancelled":
      return "orange";
    case "running":
      return "blue";
    case "dry-run":
      return "yellow";
    default:
      return "gray";
  }
}

interface SeedHistoryTabProps {
  context: ProjectDetailTabContext;
}

export const SeedHistoryTab = observer(function SeedHistoryTab({ context }: SeedHistoryTabProps) {
  const { presenter } = useFeature(SeedHistoryTabFeature);
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
  const totalPages = Math.max(1, Math.ceil(vm.seedJobsTotalCount / PAGE_SIZE));

  return (
    <Stack gap="md">
      <Group gap="xs">
        <Select
          placeholder="Status"
          data={STATUS_OPTIONS}
          value={vm.seedJobsStatusFilter}
          onChange={(value) => presenter.setSeedJobsFilter("seedStatus", value)}
          clearable
          size="xs"
          w={140}
        />
        {vm.seedJobsStatusFilter && (
          <Button
            variant="subtle"
            size="compact-xs"
            onClick={() => presenter.clearSeedJobsFilter()}
          >
            Clear filters
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Text size="sm" c="dimmed">
          {vm.seedJobsTotalCount} seed job{vm.seedJobsTotalCount === 1 ? "" : "s"}
        </Text>
      </Group>

      {vm.seedJobs.length === 0 ? (
        <Text c="dimmed" ta="center" mt="xl">
          {vm.seedJobsStatusFilter
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
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {vm.seedJobs.map((job) => (
                <Table.Tr
                  key={job.id}
                  onClick={() => presenter.viewJobEntries(job.id)}
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
                  <Table.Td>
                    {job.resumable && (
                      <Button
                        size="compact-xs"
                        variant="light"
                        onClick={(event) => {
                          // The row itself opens the run; this button starts one.
                          event.stopPropagation();
                          presenter.resumeSeedJob(job.id);
                        }}
                      >
                        Resume
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination
                total={totalPages}
                value={vm.seedJobsPage}
                onChange={(page) => presenter.loadSeedJobsPage(page)}
              />
            </Group>
          )}
        </>
      )}

      <ConfirmDialog
        vm={vm.confirmation}
        onConfirm={() => void presenter.confirmAction()}
        onCancel={() => presenter.cancelAction()}
      />
    </Stack>
  );
});
