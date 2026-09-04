import { Button, Group, Stack, Text } from "@mantine/core";
import type { ISyncLogVM } from "../abstractions/ProjectDetailPresenter.js";
import { SyncLogTable } from "./SyncLogTable.js";

interface SyncTenantsTabProps {
  logs: ISyncLogVM[];
  isSyncing: boolean;
  onSync: () => void;
  onDeleteLog: (logId: string) => void;
}

export function SyncTenantsTab({ logs, isSyncing, onSync, onDeleteLog }: SyncTenantsTabProps) {
  const tenantLogs = logs.filter((l) => l.type === "tenants");

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Button loading={isSyncing} onClick={onSync}>
          Pull Tenants
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        Pull tenants from the Webiny instance.
      </Text>
      <SyncLogTable logs={tenantLogs} onDelete={onDeleteLog} />
    </Stack>
  );
}
