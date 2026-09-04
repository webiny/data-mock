import { Button, Group, Stack, Text } from "@mantine/core";
import type { ISyncLogVM } from "../abstractions/ProjectDetailPresenter.js";
import { SyncLogTable } from "./SyncLogTable.js";

interface SyncModelsTabProps {
  logs: ISyncLogVM[];
  isSyncing: boolean;
  onSync: () => void;
  onDeleteLog: (logId: string) => void;
}

export function SyncModelsTab({ logs, isSyncing, onSync, onDeleteLog }: SyncModelsTabProps) {
  const modelLogs = logs.filter((l) => l.type === "models");

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Button loading={isSyncing} onClick={onSync}>
          Pull Models
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        Pull models and groups from the Webiny instance.
      </Text>
      <SyncLogTable logs={modelLogs} onDelete={onDeleteLog} />
    </Stack>
  );
}
