import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Badge, Button, Group, Modal, Pagination, Table, Text, Stack } from "@mantine/core";
import { usePagination } from "~/ui/components/usePagination.js";
import { useFeature } from "~/ui/di/useFeature.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { TenantsTabFeature } from "../feature.js";
import type { ITenantVM } from "../abstractions/TenantsTabPresenter.js";
import { EditTenantTokenForm } from "./EditTenantTokenForm.js";

const KEY_LABELS: Record<ITenantVM["keySource"], { label: string; color: string }> = {
  own: { label: "own key", color: "green" },
  environment: { label: "main key", color: "blue" },
  none: { label: "no key", color: "gray" },
};

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
            <Table.Th>API token</Table.Th>
            <Table.Th>Discovered</Table.Th>
            <Table.Th />
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
                <Group gap="xs" wrap="nowrap">
                  <Badge size="sm" variant="light" color={KEY_LABELS[tenant.keySource].color}>
                    {KEY_LABELS[tenant.keySource].label}
                  </Badge>
                  {tenant.apiToken !== null && (
                    <Text size="xs" ff="monospace" truncate maw={220}>
                      {tenant.apiToken}
                    </Text>
                  )}
                </Group>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {new Date(tenant.discoveredAt).toLocaleString()}
                </Text>
              </Table.Td>
              <Table.Td>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  onClick={() => presenter.openEditToken(tenant.tenantId)}
                >
                  Edit token
                </Button>
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
      <Modal
        opened={vm.editingTenant !== null}
        onClose={() => presenter.closeEditToken()}
        title={`API token for ${vm.editingTenant?.tenantId ?? ""}`}
        centered
      >
        {vm.editingTenant !== null && (
          <EditTenantTokenForm
            key={vm.editingTenant.tenantId}
            tenant={vm.editingTenant}
            onSubmit={(apiToken) => presenter.submitToken(apiToken)}
            onCancel={() => presenter.closeEditToken()}
          />
        )}
      </Modal>
    </Stack>
  );
});
