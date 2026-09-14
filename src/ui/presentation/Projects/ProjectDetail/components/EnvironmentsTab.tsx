import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Badge, Button, Group, Stack, Table, Text, Tooltip } from "@mantine/core";
import { CodeViewerModal } from "~/ui/components/CodeViewerModal.js";
import type { IEnvironmentVM, IStackVM } from "../abstractions/ProjectDetailPresenter.js";

interface EnvironmentsTabProps {
  environments: IEnvironmentVM[];
  currentEnvironment: IEnvironmentVM | null;
  stacks: IStackVM[];
  isSyncing: boolean;
  onSync: () => void;
  onSelectEnvironment: (stackName: string) => void;
}

function formatRelative(timestamp: number | null): string {
  if (timestamp === null) {
    return "never";
  }
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

/**
 * Three environment states, not two. "Partially deployed" is a real state on this machine — an
 * environment with core deployed and api not — and it is the one that cannot be seeded, so it is
 * called out rather than folded into "deployed".
 */
function environmentBadge(environment: IEnvironmentVM): { label: string; color: string } {
  if (!environment.deployed) {
    return { label: "not deployed", color: "gray" };
  }
  if (!environment.connectable) {
    return { label: "partially deployed", color: "orange" };
  }
  return { label: "deployed", color: "green" };
}

const STACK_COLORS: Record<string, string> = {
  deployed: "green",
  "not-deployed": "gray",
  unknown: "orange",
};

export const EnvironmentsTab = observer(function EnvironmentsTab({
  environments,
  currentEnvironment,
  stacks,
  isSyncing,
  onSync,
  onSelectEnvironment,
}: EnvironmentsTabProps) {
  const [rawOutput, setRawOutput] = useState<{ app: string; value: string } | null>(null);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Environments</Text>
        <Button size="xs" variant="light" loading={isSyncing} onClick={onSync}>
          Sync from disk
        </Button>
      </Group>

      {environments.length === 0 && (
        <Text c="dimmed" fs="italic">
          None discovered. Sync reads this project&apos;s Pulumi state from disk to find them.
        </Text>
      )}

      {environments.length > 0 && (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Stack</Table.Th>
              <Table.Th>Variant</Table.Th>
              <Table.Th>Region</Table.Th>
              <Table.Th>State</Table.Th>
              <Table.Th>Synced</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {environments.map((environment) => {
              const badge = environmentBadge(environment);
              return (
                <Table.Tr key={environment.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {environment.env}
                      </Text>
                      {environment.id === currentEnvironment?.id && (
                        <Badge size="xs" variant="outline">
                          selected
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {environment.variant === "" ? "—" : environment.variant}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {environment.region ?? "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip
                      disabled={environment.connectable || !environment.deployed}
                      label="The api app is not deployed, so this environment cannot be seeded."
                    >
                      <Badge size="sm" variant="light" color={badge.color}>
                        {badge.label}
                      </Badge>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {formatRelative(environment.lastSyncedAt)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {environment.id !== currentEnvironment?.id && (
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => onSelectEnvironment(environment.stackName)}
                      >
                        Select
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Text fw={600} mt="sm">
        Apps in {currentEnvironment?.stackName ?? "this environment"}
      </Text>

      {stacks.length === 0 && (
        <Text c="dimmed" fs="italic">
          No stack state stored yet. Sync to read it.
        </Text>
      )}

      {stacks.length > 0 && (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>App</Table.Th>
              <Table.Th>State</Table.Th>
              <Table.Th>Resources</Table.Th>
              <Table.Th>Read</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stacks.map((stack) => (
              <Table.Tr key={stack.app}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {stack.app}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light" color={STACK_COLORS[stack.readState] ?? "gray"}>
                    {stack.stateLabel}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {/* An unreadable stack shows a dash, never 0 — 0 would claim it is empty. */}
                  <Text size="sm" c="dimmed">
                    {stack.resourceCount === null ? "—" : stack.resourceCount}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatRelative(stack.syncedAt)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {stack.rawOutput !== null && (
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      onClick={() => setRawOutput({ app: stack.app, value: stack.rawOutput ?? "" })}
                    >
                      Raw output
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <CodeViewerModal
        opened={rawOutput !== null}
        onClose={() => setRawOutput(null)}
        title={`${rawOutput?.app ?? ""} stack output`}
        value={rawOutput?.value ?? ""}
        language="json"
      />
    </Stack>
  );
});
