import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import type { ISyncPreviewVM } from "~/ui/presentation/shared/syncPreview/SyncPreviewState.js";
import type {
  SyncEnvironmentChangeResponse,
  SyncFieldChangeResponse,
  SyncPreviewResponse,
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
  const result = vm.result;
  const changed = (result?.previews ?? []).filter((preview) => preview.hasChanges);
  const unchanged = (result?.previews ?? []).filter((preview) => !preview.hasChanges);

  return (
    <Modal opened={vm.isOpen} onClose={onClose} title="Sync from disk" size="lg" centered>
      {vm.isLoading && (
        <Group gap="sm">
          <Loader size="sm" />
          <Text>{vm.progressLabel ?? "Reading the state on disk..."}</Text>
        </Group>
      )}

      {vm.error !== null && (
        <Alert color="red" title="Could not read what a sync would change">
          {vm.error}
        </Alert>
      )}

      {result !== null && (
        <Stack gap="md">
          {result.failures.map((failure) => (
            <Alert key={failure.projectId} color="red" title="Could not be read">
              {failure.error}
            </Alert>
          ))}

          {changed.length === 0 && result.previews.length > 0 && (
            <Text>Nothing stored would change.</Text>
          )}

          {changed.map((preview) => (
            <ProjectChanges key={preview.projectId} preview={preview} />
          ))}

          {unchanged.length > 0 && changed.length > 0 && (
            <Text size="sm" c="dimmed">
              Unchanged: {unchanged.map((preview) => preview.projectName).join(", ")}
            </Text>
          )}
        </Stack>
      )}

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose} disabled={vm.isApplying}>
          Cancel
        </Button>
        <Button onClick={onApply} loading={vm.isApplying} disabled={!vm.hasChanges}>
          {changed.length > 1
            ? `Store changes for ${changed.length} projects`
            : "Store these changes"}
        </Button>
      </Group>
    </Modal>
  );
}

function ProjectChanges({ preview }: { preview: SyncPreviewResponse }) {
  return (
    <Stack gap="sm">
      <Divider label={preview.projectName} labelPosition="left" />

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

      {preview.environments
        .filter(
          (environment) => environment.change !== "unchanged" || environment.fields.length > 0,
        )
        .map((environment) => (
          <EnvironmentChanges key={environment.stackName} environment={environment} />
        ))}
    </Stack>
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
