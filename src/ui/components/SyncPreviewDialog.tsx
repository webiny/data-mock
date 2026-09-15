import { Alert, Badge, Button, Group, Loader, Modal, Stack, Table, Text } from "@mantine/core";
import type { ISyncPreviewVM } from "~/ui/presentation/shared/syncPreview/SyncPreviewState.js";
import type {
  SyncEnvironmentChangeResponse,
  SyncFieldChangeResponse,
} from "~/shared/responses/sync.js";

interface SyncPreviewDialogProps {
  vm: ISyncPreviewVM;
  onApply: () => void;
  onClose: () => void;
}

const CHANGE_COLOR: Record<string, string> = {
  added: "green",
  updated: "blue",
  unchanged: "gray",
  skipped: "gray",
  unreadable: "orange",
};

export function SyncPreviewDialog({ vm, onApply, onClose }: SyncPreviewDialogProps) {
  const preview = vm.preview;

  return (
    <Modal opened={vm.isOpen} onClose={onClose} title="Sync from disk" size="lg" centered>
      {vm.isLoading && (
        <Group gap="sm">
          <Loader size="sm" />
          <Text>Reading the state on disk...</Text>
        </Group>
      )}

      {vm.error !== null && (
        <Alert color="red" title="Could not read what a sync would change">
          {vm.error}
        </Alert>
      )}

      {preview !== null && (
        <Stack gap="md">
          <Text>
            {preview.hasChanges
              ? `Storing this sync would change what is recorded for "${preview.projectName}".`
              : `Nothing stored for "${preview.projectName}" would change.`}
          </Text>

          {preview.messages.map((message) => (
            <Alert key={message} color="yellow">
              {message}
            </Alert>
          ))}

          {preview.project.length > 0 && (
            <Stack gap="xs">
              <Text fw={600}>Project</Text>
              <FieldTable fields={preview.project} />
            </Stack>
          )}

          {preview.environments.map((environment) => (
            <EnvironmentChanges key={environment.stackName} environment={environment} />
          ))}
        </Stack>
      )}

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose} disabled={vm.isApplying}>
          Cancel
        </Button>
        <Button
          onClick={onApply}
          loading={vm.isApplying}
          disabled={preview === null || !preview.hasChanges}
        >
          Store these changes
        </Button>
      </Group>
    </Modal>
  );
}

function EnvironmentChanges({ environment }: { environment: SyncEnvironmentChangeResponse }) {
  const changedStacks = environment.stacks.filter((stack) => stack.fields.length > 0);

  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Text fw={600}>{environment.stackName}</Text>
        <Badge color={CHANGE_COLOR[environment.change] ?? "gray"} variant="light">
          {environment.change}
        </Badge>
      </Group>

      {environment.note !== null && (
        <Text size="sm" c="dimmed">
          {environment.note}
        </Text>
      )}

      {environment.fields.length > 0 && <FieldTable fields={environment.fields} />}

      {changedStacks.map((stack) => (
        <Stack key={stack.app} gap={4}>
          <Text size="sm" fw={500}>
            {stack.app}
          </Text>
          <FieldTable fields={stack.fields} />
        </Stack>
      ))}
    </Stack>
  );
}

function FieldTable({ fields }: { fields: SyncFieldChangeResponse[] }) {
  return (
    <Table withTableBorder withColumnBorders>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Field</Table.Th>
          <Table.Th>Stored now</Table.Th>
          <Table.Th>After sync</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {fields.map((field) => (
          <Table.Tr key={field.field}>
            <Table.Td>{field.label}</Table.Td>
            <Table.Td c="dimmed">{field.current ?? "—"}</Table.Td>
            <Table.Td>{field.incoming ?? "—"}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
