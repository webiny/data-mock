import { Button, Group, Stack, Text, Title } from "@mantine/core";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import { SyncLogTable } from "./SyncLogTable.js";

interface SyncModelsTabProps {
  logs: ProjectDetailPresenter.VM["syncLog"];
  isSyncing: boolean;
  onSync: () => void;
  onDeleteLog: (logId: string) => void;
}

export function SyncModelsTab({ logs, isSyncing, onSync, onDeleteLog }: SyncModelsTabProps) {
  const modelLogs = logs.filter((l) => l.type === "models");

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Sync Models & Groups</Title>
        <Button loading={isSyncing} onClick={onSync}>
          Run Sync
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        Pull models and groups from the Webiny instance.
      </Text>
      <SyncLogTable logs={modelLogs} onDelete={onDeleteLog} />
    </Stack>
  );
}
