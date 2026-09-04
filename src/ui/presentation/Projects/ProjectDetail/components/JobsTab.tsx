import { useState } from "react";
import {
  Badge,
  Button,
  Code,
  Group,
  Modal,
  Pagination,
  Progress,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import type { Job } from "~/shared/types.js";

const PAGE_SIZE = 25;

const statusColor: Record<string, string> = {
  pending: "gray",
  running: "blue",
  completed: "green",
  failed: "red",
  cancelled: "yellow",
  interrupted: "orange",
};

const typeLabels: Record<string, string> = {
  seed: "Seed data",
  "pull-tenants": "Pull tenants",
  "pull-models": "Pull models",
  cleanup: "Cleanup",
  import: "Import",
  "upload-files": "Upload files",
};

const TYPE_OPTIONS = [
  { value: "seed", label: "Seed data" },
  { value: "pull-tenants", label: "Pull tenants" },
  { value: "pull-models", label: "Pull models" },
  { value: "cleanup", label: "Cleanup" },
  { value: "import", label: "Import" },
  { value: "upload-files", label: "Upload files" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "interrupted", label: "Interrupted" },
];

interface JobsTabProps {
  jobs: Job[];
  totalCount: number;
  page: number;
  typeFilter: string | null;
  statusFilter: string | null;
  onPageChange: (page: number) => void;
  onFilterChange: (key: string, value: string | null) => void;
  onClearFilter: () => void;
  onCancel?: (jobId: string) => void;
}

export function JobsTab({
  jobs,
  totalCount,
  page,
  typeFilter,
  statusFilter,
  onPageChange,
  onFilterChange,
  onClearFilter,
  onCancel,
}: JobsTabProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = typeFilter || statusFilter;

  return (
    <Stack gap="md">
      <Title order={5}>Background Jobs</Title>

      <Group gap="xs">
        <Select
          placeholder="Type"
          data={TYPE_OPTIONS}
          value={typeFilter}
          onChange={(v) => onFilterChange("jobType", v)}
          clearable
          size="xs"
          w={160}
        />
        <Select
          placeholder="Status"
          data={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(v) => onFilterChange("jobStatus", v)}
          clearable
          size="xs"
          w={140}
        />
        {hasFilters && (
          <Button variant="subtle" size="compact-xs" onClick={onClearFilter}>
            Clear filters
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Text size="sm" c="dimmed">
          {totalCount} job{totalCount === 1 ? "" : "s"}
        </Text>
      </Group>

      {jobs.length === 0 ? (
        <Text c="dimmed" ta="center" mt="xl">
          {hasFilters
            ? "No jobs match the current filters."
            : "No jobs yet. Trigger a seed, sync, import, or cleanup to create one."}
        </Text>
      ) : (
        <>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Progress</Table.Th>
                <Table.Th>Duration</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {jobs.map((job) => (
                <Table.Tr
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  style={{ cursor: "pointer" }}
                >
                  <Table.Td>
                    <Text size="sm">{new Date(job.createdAt).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {typeLabels[job.type] ?? job.type}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor[job.status] ?? "gray"} size="sm">
                      {job.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <JobProgress job={job} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatDuration(job)}</Text>
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

      <Modal
        opened={selectedJob !== null}
        onClose={() => setSelectedJob(null)}
        title={
          selectedJob
            ? `${typeLabels[selectedJob.type] ?? selectedJob.type} — ${selectedJob.status}`
            : ""
        }
        size="lg"
      >
        {selectedJob && (
          <JobDetail
            job={selectedJob}
            onCancel={
              onCancel && (selectedJob.status === "pending" || selectedJob.status === "running")
                ? () => {
                    onCancel(selectedJob.id);
                    setSelectedJob(null);
                  }
                : undefined
            }
          />
        )}
      </Modal>
    </Stack>
  );
}

function JobProgress({ job }: { job: Job }) {
  if (job.progress === null) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }

  return (
    <Stack gap={2}>
      <Progress value={job.progress} size="sm" w={100} />
      <Text size="xs" c="dimmed">
        {job.progressLabel ?? `${job.progress}%`}
      </Text>
    </Stack>
  );
}

function JobDetail({ job, onCancel }: { job: Job; onCancel?: (() => void) | undefined }) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  return (
    <Stack gap="md">
      <Group gap="xl">
        <div>
          <Text size="xs" c="dimmed">
            ID
          </Text>
          <Text size="sm" ff="monospace">
            {job.id}
          </Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">
            Status
          </Text>
          <Badge color={statusColor[job.status] ?? "gray"}>{job.status}</Badge>
        </div>
        {job.startedAt && (
          <div>
            <Text size="xs" c="dimmed">
              Started
            </Text>
            <Text size="sm">{new Date(job.startedAt).toLocaleString()}</Text>
          </div>
        )}
        {job.completedAt && (
          <div>
            <Text size="xs" c="dimmed">
              Completed
            </Text>
            <Text size="sm">{new Date(job.completedAt).toLocaleString()}</Text>
          </div>
        )}
      </Group>

      {job.progress !== null && (
        <div>
          <Text size="xs" c="dimmed" fw={600}>
            Progress
          </Text>
          <Progress value={job.progress} size="md" mt={4} />
          {job.progressLabel && (
            <Text size="xs" c="dimmed" mt={2}>
              {job.progressLabel}
            </Text>
          )}
        </div>
      )}

      {onCancel && !showCancelConfirm && (
        <Button color="red" variant="light" size="xs" onClick={() => setShowCancelConfirm(true)}>
          Cancel Job
        </Button>
      )}
      {onCancel && showCancelConfirm && (
        <Group gap="xs">
          <Text size="sm" fw={500}>
            Cancel this job?
          </Text>
          <Button
            color="red"
            size="xs"
            onClick={() => {
              onCancel();
              setShowCancelConfirm(false);
            }}
          >
            Yes, cancel
          </Button>
          <Button variant="default" size="xs" onClick={() => setShowCancelConfirm(false)}>
            No
          </Button>
        </Group>
      )}

      {job.config != null && (
        <>
          <Text size="xs" c="dimmed" fw={600}>
            Config
          </Text>
          <Code block>
            {String(
              typeof job.config === "string" ? job.config : JSON.stringify(job.config, null, 2),
            )}
          </Code>
        </>
      )}

      {job.logs && (
        <>
          <Text size="xs" c="dimmed" fw={600}>
            Logs
          </Text>
          <ScrollArea h={300}>
            <Code block style={{ whiteSpace: "pre-wrap" }}>
              {job.logs}
            </Code>
          </ScrollArea>
        </>
      )}
    </Stack>
  );
}

function formatDuration(job: Job): string {
  if (!job.startedAt) {
    return "—";
  }
  const end = job.completedAt ?? Date.now();
  const ms = end - job.startedAt;
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
