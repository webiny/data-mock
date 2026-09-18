import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Pagination,
  Progress,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { Editor } from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import type { Job } from "~/shared/types.js";
import type { JobSummary } from "~/ui/features/jobs/abstractions/JobsGateway.js";
import { JOB_TYPE_OPTIONS, getJobTypeLabel } from "~/shared/jobs/descriptors.js";

const PAGE_SIZE = 25;

const statusColor: Record<string, string> = {
  pending: "gray",
  running: "blue",
  completed: "green",
  failed: "red",
  cancelled: "yellow",
  interrupted: "orange",
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "interrupted", label: "Interrupted" },
];

interface JobsTableProps {
  jobs: JobSummary[];
  /**
   * The job whose panel is open, with its log. Fetched one at a time rather than carried on every
   * list row — a deploy streams thousands of Pulumi lines into a log the table never shows.
   */
  selectedJob: Job | null;
  isLoadingSelectedJob: boolean;
  onOpenJob: (jobId: string) => void;
  onCloseJob: () => void;
  totalCount: number;
  page: number;
  typeFilter: string | null;
  statusFilter: string | null;
  onPageChange: (page: number) => void;
  onFilterChange: (key: string, value: string | null) => void;
  onClearFilter: () => void;
  onCancel?: (jobId: string) => void;
  /** Live log tail for a running job. Falls back to the stored log when empty. */
  liveLogsFor?: (jobId: string) => string;
}

/**
 * Dumb display of a jobs list: the table, the filters, pagination, the job detail panel and the
 * log viewer. Owns no state beyond what is purely local to rendering (the cancel confirmation).
 *
 * Shared by the project's own Jobs tab (`JobsTabPresenter`) and the global Activity page
 * (`ActivityPresenter`) — each supplies its own vm and callbacks. `onCancel` and `liveLogsFor` are
 * optional because the Activity page has no live log tail and some callers offer no cancellation.
 */
export const JobsTable = observer(function JobsTable({
  jobs,
  selectedJob,
  isLoadingSelectedJob,
  onOpenJob,
  onCloseJob,
  totalCount,
  page,
  typeFilter,
  statusFilter,
  onPageChange,
  onFilterChange,
  onClearFilter,
  onCancel,
  liveLogsFor,
}: JobsTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = typeFilter || statusFilter;

  return (
    <Stack gap="md">
      <Title order={5}>Background Jobs</Title>

      <Group gap="xs">
        <Select
          placeholder="Type"
          data={[...JOB_TYPE_OPTIONS]}
          value={typeFilter}
          onChange={(value) => onFilterChange("jobType", value)}
          clearable
          size="xs"
          w={160}
        />
        <Select
          placeholder="Status"
          data={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(value) => onFilterChange("jobStatus", value)}
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
                  onClick={() => onOpenJob(job.id)}
                  style={{ cursor: "pointer" }}
                >
                  <Table.Td>
                    <Text size="sm">{new Date(job.createdAt).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {getJobTypeLabel(job.type)}
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
        opened={selectedJob !== null || isLoadingSelectedJob}
        onClose={onCloseJob}
        title={selectedJob ? `${getJobTypeLabel(selectedJob.type)} — ${selectedJob.status}` : ""}
        size="lg"
      >
        {selectedJob === null ? (
          <Loader size="sm" />
        ) : (
          <JobDetail
            job={selectedJob}
            liveLogs={liveLogsFor?.(selectedJob.id) ?? ""}
            onCancel={
              onCancel && (selectedJob.status === "pending" || selectedJob.status === "running")
                ? () => {
                    onCancel(selectedJob.id);
                    onCloseJob();
                  }
                : undefined
            }
          />
        )}
      </Modal>
    </Stack>
  );
});

function JobProgress({ job }: { job: JobSummary }) {
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

const JobDetail = observer(function JobDetail({
  job,
  liveLogs,
  onCancel,
}: {
  job: Job;
  liveLogs: string;
  onCancel?: (() => void) | undefined;
}) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  /**
   * Live lines win over `job.logs` while they exist: the stored column is only flushed every
   * couple of seconds, so a running deploy would otherwise look frozen.
   */
  const logs = liveLogs !== "" ? liveLogs : (job.logs ?? "");

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
          <Editor
            height="200px"
            language="json"
            value={formatJsonValue(job.config)}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              wordWrap: "on",
              lineNumbers: "on",
            }}
          />
        </>
      )}

      {logs !== "" && (
        <>
          <Group gap="xs">
            <Text size="xs" c="dimmed" fw={600}>
              Logs
            </Text>
            {liveLogs !== "" && job.status === "running" && (
              <Badge size="xs" variant="light" color="blue">
                live
              </Badge>
            )}
          </Group>
          <LogViewer value={logs} follow={job.status === "running"} />
        </>
      )}
    </Stack>
  );
});

/**
 * Follows the tail while the job runs, and stops as soon as it finishes so a finished log can be
 * scrolled back through without being yanked to the bottom.
 */
function LogViewer({ value, follow }: { value: string; follow: boolean }) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  useEffect(() => {
    if (!follow || editorRef.current === null) {
      return;
    }
    editorRef.current.revealLine(value.split("\n").length);
  }, [value, follow]);

  return (
    <Editor
      height="300px"
      language="plaintext"
      value={value}
      theme="vs-dark"
      onMount={(editor) => {
        editorRef.current = editor;
      }}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        wordWrap: "on",
        lineNumbers: "off",
      }}
    />
  );
}

function formatJsonValue(value: unknown): string {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

function formatDuration(job: JobSummary): string {
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
