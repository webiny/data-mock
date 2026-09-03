import { useState } from "react";
import { Badge, Button, Group, Modal, Stack, Table, Text } from "@mantine/core";
import { CodeViewerModal } from "~/ui/components/CodeViewerModal.js";
import type { ISyncLogVM } from "../abstractions/ProjectDetailPresenter.js";

interface OperationEntry {
  name: string;
  url: string;
  query: string;
  httpStatus: number;
  response: unknown;
}

interface ViewerState {
  title: string;
  value: string;
  language: string;
}

function extractOperations(request: unknown): OperationEntry[] {
  if (Array.isArray(request)) {
    return request as OperationEntry[];
  }
  return [];
}

function formatJson(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

interface SyncLogTableProps {
  logs: ISyncLogVM[];
  onDelete: (logId: string) => void;
}

export function SyncLogTable({ logs, onDelete }: SyncLogTableProps) {
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const showRequest = (op: OperationEntry) => {
    const info = [
      `# ${op.name}`,
      `# URL: ${op.url}`,
      `# HTTP Status: ${op.httpStatus}`,
      "",
      op.query,
    ].join("\n");
    setViewer({ title: `Request — ${op.name}`, value: info, language: "graphql" });
  };

  const showResponse = (op: OperationEntry) => {
    setViewer({
      title: `Response — ${op.name}`,
      value: formatJson(op.response),
      language: "json",
    });
  };

  const showRawResponse = (log: ISyncLogVM) => {
    setViewer({
      title: "Response",
      value: log.response != null ? formatJson(log.response) : "null",
      language: "json",
    });
  };

  if (logs.length === 0) {
    return (
      <Text c="dimmed" ta="center" mt="md">
        No sync history. Click &ldquo;Run Sync&rdquo; to start.
      </Text>
    );
  }

  return (
    <>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Message</Table.Th>
            <Table.Th>Request</Table.Th>
            <Table.Th>Response</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {logs.map((log) => {
            const operations = extractOperations(log.request);
            return (
              <Table.Tr key={log.id}>
                <Table.Td>
                  <Text size="sm">{new Date(log.createdAt).toLocaleString()}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={log.status === "success" ? "green" : "red"} size="sm">
                    {log.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{log.message}</Text>
                </Table.Td>
                <Table.Td>
                  {operations.length > 0 ? (
                    <Stack gap={4}>
                      {operations.map((op) => (
                        <Button
                          key={op.name}
                          variant="light"
                          size="compact-xs"
                          onClick={() => showRequest(op)}
                        >
                          {op.name}
                        </Button>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {operations.length > 0 ? (
                    <Stack gap={4}>
                      {operations.map((op) => (
                        <Button
                          key={op.name}
                          variant="light"
                          size="compact-xs"
                          onClick={() => showResponse(op)}
                        >
                          {op.name}
                        </Button>
                      ))}
                    </Stack>
                  ) : log.response != null ? (
                    <Button variant="light" size="compact-xs" onClick={() => showRawResponse(log)}>
                      View
                    </Button>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Button
                    variant="subtle"
                    color="red"
                    size="compact-xs"
                    onClick={() => setDeleteConfirm(log.id)}
                  >
                    Delete
                  </Button>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      {viewer && (
        <CodeViewerModal
          opened={true}
          onClose={() => setViewer(null)}
          title={viewer.title}
          value={viewer.value}
          language={viewer.language}
        />
      )}

      <Modal
        opened={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Sync Log"
        centered
        size="sm"
      >
        <Text>Delete this sync log entry?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              if (deleteConfirm) {
                onDelete(deleteConfirm);
              }
              setDeleteConfirm(null);
            }}
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </>
  );
}
