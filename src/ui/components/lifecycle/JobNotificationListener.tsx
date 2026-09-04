import { useEffect } from "react";
import { notifications } from "@mantine/notifications";
import { useContainer } from "~/ui/di/DiContainerProvider.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";

const STATUS_CONFIG: Record<string, { color: string; message: string; autoClose: number | false }> =
  {
    completed: { color: "green", message: "completed successfully.", autoClose: 5000 },
    failed: { color: "red", message: "failed. Check the job log for details.", autoClose: false },
    cancelled: { color: "yellow", message: "was cancelled.", autoClose: 5000 },
    interrupted: {
      color: "orange",
      message: "was interrupted by a server restart.",
      autoClose: false,
    },
  };

const JOB_TYPE_LABELS: Record<string, string> = {
  seed: "Seed data",
  "pull-tenants": "Pull tenants",
  "pull-models": "Pull models",
  cleanup: "Cleanup entries",
  import: "Import entries",
};

function handleJobStatus(event: WSJobStatus): void {
  if (!TERMINAL_JOB_STATUSES.has(event.status)) {
    return;
  }

  const config = STATUS_CONFIG[event.status] ?? {
    color: "gray",
    message: `finished with status "${event.status}".`,
    autoClose: 5000,
  };
  const label = JOB_TYPE_LABELS[event.type] ?? event.type;

  notifications.show({
    title: label,
    message: `${label} ${config.message}`,
    color: config.color,
    autoClose: config.autoClose,
  });
}

export function JobNotificationListener(): null {
  const container = useContainer();

  useEffect(() => {
    const eventBridge = container.resolve(EventBridge);
    const dispose = eventBridge.on("job:status", handleJobStatus);
    return dispose;
  }, [container]);

  return null;
}
