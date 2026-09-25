import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Badge, Button, Group, Modal, Pagination, Stack, Table, Text } from "@mantine/core";
import { CodeViewerModal } from "~/ui/components/CodeViewerModal.js";
import { ConfirmDialog } from "~/ui/components/ConfirmDialog.js";
import { useFeature } from "~/ui/di/useFeature.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { PullModelsTabFeature } from "../feature.js";
import type { ISyncLogVM } from "../abstractions/PullModelsTabPresenter.js";

const PAGE_SIZE = 25;

interface RequestEntry {
  name: string;
  url?: string;
  query?: string;
  method?: string;
  variables?: unknown;
}

interface ResponseEntry {
  name: string;
  httpStatus: number;
  body: unknown;
}

interface ViewerState {
  title: string;
  value: string;
  language: string;
}

function extractArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    // Parse boundary: `value` is raw JSON stored on the sync log, display-only from here.
    return value as T[];
  }
  return [];
}

function formatJson(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

interface PullModelsTabProps {
  context: ProjectDetailTabContext;
}

export const PullModelsTab = observer(function PullModelsTab({ context }: PullModelsTabProps) {
  const { presenter } = useFeature(PullModelsTabFeature);
  const projectId = context.projectId;
  const environmentId = context.ref?.environmentId ?? null;

  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
  const totalPages = Math.max(1, Math.ceil(vm.syncLogsTotalCount / PAGE_SIZE));

  const showRequest = (request: RequestEntry) => {
    setViewer({
      title: `Request — ${request.name}`,
      value: formatJson(request),
      language: "json",
    });
  };

  const showResponse = (response: ResponseEntry) => {
    setViewer({
      title: `Response — ${response.name}`,
      value: formatJson(response),
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
      <Group justify="space-between">
        <Button loading={vm.isSyncingModels} onClick={() => presenter.pullModels()}>
          Pull Models
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        Pull models and groups from the Webiny instance, for every tenant that has an API key. Set a
        tenant&apos;s key in the Tenants tab.
      </Text>

      {vm.syncLogs.length === 0 ? (
        <Text c="dimmed" ta="center" mt="md">
          No pull history yet.
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
              {vm.syncLogs.map((log) => {
                const requestOps = extractArray<RequestEntry>(log.request);
                const responseOps = extractArray<ResponseEntry>(log.response);
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
                      {requestOps.length > 0 ? (
                        <Stack gap={4}>
                          {requestOps.map((request) => (
                            <Button
                              key={request.name}
                              variant="light"
                              size="compact-xs"
                              onClick={() => showRequest(request)}
                            >
                              {request.name}
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
                      {responseOps.length > 0 ? (
                        <Stack gap={4}>
                          {responseOps.map((response) => (
                            <Button
                              key={response.name}
                              variant="light"
                              size="compact-xs"
                              onClick={() => showResponse(response)}
                            >
                              {response.name}
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
                value={vm.syncLogsPage}
                onChange={(page) => presenter.loadSyncLogsPage(page)}
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
                void presenter.deleteSyncLog(deleteConfirm);
              }
              setDeleteConfirm(null);
            }}
          >
            Delete
          </Button>
        </Group>
      </Modal>

      <ConfirmDialog
        vm={vm.confirmation}
        onConfirm={() => void presenter.confirmAction()}
        onCancel={() => presenter.cancelAction()}
      />
    </Stack>
  );
});
