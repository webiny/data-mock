import { Badge, Button, Group, Stack, Table, Text, Title } from "@mantine/core";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";

interface AuditLogTabProps {
  entries: ProjectDetailPresenter.VM["entries"];
  isClearing: boolean;
  onClear: () => void;
}

const statusColor: Record<string, string> = {
  created: "green",
  failed: "red",
  "dry-run": "yellow",
};

export function AuditLogTab({ entries, isClearing, onClear }: AuditLogTabProps) {
  if (entries.length === 0) {
    return (
      <Stack align="center" mt="xl">
        <Text c="dimmed">No seed entries. Run a seed job to see entries here.</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Audit Log ({entries.length})</Title>
        <Button variant="subtle" color="red" size="xs" loading={isClearing} onClick={onClear}>
          Clear All
        </Button>
      </Group>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Model</Table.Th>
            <Table.Th>Tenant</Table.Th>
            <Table.Th>Entry ID</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {entries.map((entry) => (
            <Table.Tr key={entry.id}>
              <Table.Td>
                <Text size="sm">{new Date(entry.createdAt).toLocaleString()}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {entry.modelId}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge variant="outline" size="sm">
                  {entry.tenant}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" ff="monospace">
                  {entry.entryId}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge color={statusColor[entry.status] ?? "gray"} size="sm">
                  {entry.status}
                </Badge>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
