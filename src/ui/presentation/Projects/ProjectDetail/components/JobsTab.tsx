import { useState } from "react";
import {
  Badge,
  Button,
  Code,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import type { Job } from "~/shared/types.js";

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
  "sync-tenants": "Sync tenants",
  "sync-models": "Sync models",
  cleanup: "Cleanup",
  import: "Import",
};

interface JobsTabProps {
  jobs: Job[];
  onCancel?: (jobId: string) => void;
}

export function JobsTab({ jobs, onCancel }: JobsTabProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  if (jobs.length === 0) {
    return (
      <Text c="dimmed" ta="center" mt="xl">
        No jobs yet. Trigger a seed, sync, import, or cleanup to create one.
      </Text>
    );
  }

  const sorted = [...jobs].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Stack gap="md">
      <Title order={5}>Background Jobs</Title>
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
          {sorted.map((job) => (
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
                <Text size="sm">{job.progress !== null ? `${job.progress}%` : "—"}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{formatDuration(job)}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

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
