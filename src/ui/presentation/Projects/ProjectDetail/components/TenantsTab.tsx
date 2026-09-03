import { observer } from "mobx-react-lite";
import { Badge, Table, Text, Stack } from "@mantine/core";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";

interface TenantsTabProps {
  tenants: ProjectDetailPresenter.VM["tenants"];
}

export const TenantsTab = observer(function TenantsTab({ tenants }: TenantsTabProps) {
  if (tenants.length === 0) {
    return (
      <Text c="dimmed" fs="italic">
        No tenants discovered. Click &quot;Sync All&quot; to fetch them.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Tenant ID</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Discovered</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {tenants.map((t) => (
            <Table.Tr key={t.tenantId}>
              <Table.Td>
                <Badge variant="outline" size="sm">
                  {t.tenantId}
                </Badge>
              </Table.Td>
              <Table.Td>{t.name}</Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {new Date(t.discoveredAt).toLocaleString()}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
});
