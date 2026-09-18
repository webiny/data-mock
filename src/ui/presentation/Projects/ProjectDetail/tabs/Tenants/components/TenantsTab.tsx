import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Badge, Group, Pagination, Table, Text, Stack } from "@mantine/core";
import { usePagination } from "~/ui/components/usePagination.js";
import { useFeature } from "~/ui/di/useFeature.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { TenantsTabFeature } from "../feature.js";

interface TenantsTabProps {
  context: ProjectDetailTabContext;
}

export const TenantsTab = observer(function TenantsTab({ context }: TenantsTabProps) {
  const { presenter } = useFeature(TenantsTabFeature);
  const projectId = context.projectId;
  const environmentId = context.ref?.environmentId ?? null;

  /**
   * The component is what knows the tab is on screen, so it is what asks for the data. The
   * environment is a dependency as well as the project: the shell resolves it asynchronously, so
   * on a first visit this runs once without one, reads nothing, and runs again when it arrives.
   */
  useEffect(() => {
    void presenter.activate(context);
    return () => presenter.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenter, projectId, environmentId]);

  const vm = presenter.vm;
  const { page, totalPages, pageItems, setPage } = usePagination(vm.tenants);

  if (vm.tenants.length === 0) {
    return (
      <Text c="dimmed" fs="italic">
        No tenants discovered. Pull them from the live system to fill this list.
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
          {pageItems.map((tenant) => (
            <Table.Tr key={tenant.tenantId}>
              <Table.Td>
                <Badge variant="outline" size="sm">
                  {tenant.tenantId}
                </Badge>
              </Table.Td>
              <Table.Td>{tenant.name}</Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {new Date(tenant.discoveredAt).toLocaleString()}
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
