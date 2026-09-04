import { useState } from "react";
import { Badge, Button, Group, Modal, Pagination, Select, Stack, Table, Text } from "@mantine/core";
import { CodeViewerModal } from "~/ui/components/CodeViewerModal.js";
import type { ISyncLogVM } from "../abstractions/ProjectDetailPresenter.js";

const PAGE_SIZE = 25;

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

const TYPE_OPTIONS = [
  { value: "tenants", label: "Tenants" },
  { value: "models", label: "Models" },
  { value: "upload-file", label: "Upload file" },
  { value: "pull-files", label: "Pull files" },
];

const STATUS_OPTIONS = [
  { value: "success", label: "Success" },
  { value: "error", label: "Error" },
];

interface SyncLogTableProps {
  logs: ISyncLogVM[];
  totalCount?: number;
  page?: number;
  typeFilter?: string | null;
  statusFilter?: string | null;
  onPageChange?: (page: number) => void;
  onFilterChange?: (key: string, value: string | null) => void;
  onClearFilter?: () => void;
  onDelete: (logId: string) => void;
}

export function SyncLogTable({
  logs,
  totalCount,
  page: pageProp,
  typeFilter,
  statusFilter,
  onPageChange,
  onFilterChange,
  onClearFilter,
  onDelete,
}: SyncLogTableProps) {
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clientPage, setClientPage] = useState(1);
  const serverPaginated = totalCount !== undefined && onPageChange !== undefined;
  const effectiveTotal = serverPaginated ? totalCount : logs.length;
  const page = serverPaginated ? (pageProp ?? 1) : clientPage;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / PAGE_SIZE));
  const displayLogs = serverPaginated ? logs : logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showFilters = onFilterChange !== undefined;
  const hasFilters = typeFilter || statusFilter;

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

  const showFullDetail = (log: ISyncLogVM) => {
    const sections: string[] = [];
    if (log.request != null) {
      sections.push(`// REQUEST\n${formatJson(log.request)}`);
    }
    if (log.response != null) {
      sections.push(`// RESPONSE\n${formatJson(log.response)}`);
    }
    setViewer({
      title: `${log.type} — ${log.message}`,
      value: sections.length > 0 ? sections.join("\n\n") : "No data",
      language: "json",
    });
  };

  return (
    <Stack gap="md">
      {showFilters && (
        <Group gap="xs">
          <Select
            placeholder="Type"
            data={TYPE_OPTIONS}
            value={typeFilter ?? null}
            onChange={(v) => onFilterChange!("logType", v)}
            clearable
            size="xs"
            w={160}
          />
          <Select
            placeholder="Status"
            data={STATUS_OPTIONS}
            value={statusFilter ?? null}
            onChange={(v) => onFilterChange!("logStatus", v)}
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
            {effectiveTotal} log{effectiveTotal === 1 ? "" : "s"}
          </Text>
        </Group>
      )}

      {displayLogs.length === 0 ? (
        <Text c="dimmed" ta="center" mt="md">
          {hasFilters ? "No logs match the current filters." : "No pull history yet."}
        </Text>
      ) : (
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
              {displayLogs.map((log) => {
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
                      ) : log.request != null ? (
                        <Button
                          variant="light"
                          size="compact-xs"
                          onClick={() => showFullDetail(log)}
                        >
                          View
                        </Button>
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
                        <Button
                          variant="light"
                          size="compact-xs"
                          onClick={() => showFullDetail(log)}
                        >
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

          {totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination
                total={totalPages}
                value={page}
                onChange={serverPaginated ? onPageChange : setClientPage}
              />
            </Group>
          )}
        </>
      )}

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
    </Stack>
  );
}
