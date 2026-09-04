import { observer } from "mobx-react-lite";
import { Badge, Group, Pagination, Table, Text, Stack } from "@mantine/core";
import { usePagination } from "~/ui/components/usePagination.js";
import type { ITenantVM } from "../abstractions/ProjectDetailPresenter.js";

interface TenantsTabProps {
  tenants: ITenantVM[];
}

export const TenantsTab = observer(function TenantsTab({ tenants }: TenantsTabProps) {
  const { page, totalPages, pageItems, setPage } = usePagination(tenants);

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
          {pageItems.map((t) => (
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
      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}
    </Stack>
  );
});
