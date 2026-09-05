import { Button, Group, Stack, Text } from "@mantine/core";
import type { ISyncLogVM } from "../abstractions/ProjectDetailPresenter.js";
import { SyncLogTable } from "./SyncLogTable.js";

interface PullImagesTabProps {
  logs: ISyncLogVM[];
  isPulling: boolean;
  onPull: () => void;
  onDeleteLog: (logId: string) => void;
}

export function PullImagesTab({ logs, isPulling, onPull, onDeleteLog }: PullImagesTabProps) {
  const imageLogs = logs.filter((l) => l.type === "upload-file" || l.type === "pull-files");

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Button loading={isPulling} onClick={onPull}>
          Pull Files from FM
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        Pull files from the Webiny File Manager into the local project file pool.
      </Text>
      <SyncLogTable logs={imageLogs} onDelete={onDeleteLog} />
    </Stack>
  );
}
