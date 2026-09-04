import { useEffect } from "react";
import { notifications } from "@mantine/notifications";
import { useContainer } from "~/ui/di/DiContainerProvider.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";

const STATUS_CONFIG: Record<string, { color: string; prefix: string; autoClose: number | false }> =
  {
    completed: { color: "green", prefix: "Completed", autoClose: 5000 },
    failed: { color: "red", prefix: "Failed", autoClose: false },
    cancelled: { color: "yellow", prefix: "Cancelled", autoClose: 5000 },
    interrupted: { color: "orange", prefix: "Interrupted", autoClose: false },
  };

const JOB_TYPE_LABELS: Record<string, string> = {
  seed: "Seed data",
  "sync-tenants": "Sync tenants",
  "sync-models": "Sync models",
  cleanup: "Cleanup entries",
  import: "Import entries",
};

function handleJobStatus(event: WSJobStatus): void {
  if (!TERMINAL_JOB_STATUSES.has(event.status)) {
    return;
  }

  const config = STATUS_CONFIG[event.status] ?? {
    color: "gray",
    prefix: event.status,
    autoClose: 5000,
  };
  const label = JOB_TYPE_LABELS[event.type] ?? event.type;

  notifications.show({
    title: `${config.prefix}: ${label}`,
    message: `Job ${event.jobId.slice(0, 8)} finished with status "${event.status}".`,
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
