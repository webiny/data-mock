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

function extractOperations(response: unknown): OperationEntry[] {
  if (response == null || typeof response !== "object") {
    return [];
  }
  const obj = response as Record<string, unknown>;
  if (Array.isArray(obj["operations"])) {
    return obj["operations"] as OperationEntry[];
  }
  return [];
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
    const value =
      typeof op.response === "string" ? op.response : JSON.stringify(op.response, null, 2);
    setViewer({ title: `Response — ${op.name}`, value, language: "json" });
  };

  const showRawResponse = (log: ISyncLogVM) => {
    const value =
      typeof log.response === "string" ? log.response : JSON.stringify(log.response, null, 2);
    setViewer({ title: "Raw Response", value: value ?? "null", language: "json" });
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
            <Table.Th>Details</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {logs.map((log) => {
            const operations = extractOperations(log.response);
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
                        <Group key={op.name} gap={4}>
                          <Text size="xs" fw={500} c="dimmed">
                            {op.name}
                          </Text>
                          <Button
                            variant="subtle"
                            size="compact-xs"
                            onClick={() => showRequest(op)}
                          >
                            Request
                          </Button>
                          <Button
                            variant="subtle"
                            size="compact-xs"
                            onClick={() => showResponse(op)}
                          >
                            Response
                          </Button>
                        </Group>
                      ))}
                    </Stack>
                  ) : log.response != null ? (
                    <Button variant="subtle" size="compact-xs" onClick={() => showRawResponse(log)}>
                      View Response
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
