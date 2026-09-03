import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
  Stack,
  Group,
  Title,
  Text,
  Button,
  Checkbox,
  NumberInput,
  Select,
  Card,
  Loader,
  Alert,
  Badge,
} from "@mantine/core";
import type { SeedConfigPresenter } from "../abstractions/SeedConfigPresenter.js";

interface SeedConfigPageProps {
  presenter: SeedConfigPresenter.Interface;
  projectId: string;
}

export const SeedConfigPage = observer(function SeedConfigPage({
  presenter,
  projectId,
}: SeedConfigPageProps) {
  useEffect(() => {
    void presenter.load(projectId);
  }, [presenter, projectId]);

  const { vm } = presenter;

  if (vm.isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
        <Text>Loading seed configuration...</Text>
      </Stack>
    );
  }

  if (vm.error && !vm.project) {
    return (
      <Alert color="red" title="Error">
        {vm.error}
      </Alert>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={3}>Seed Data — {vm.project?.name}</Title>
      </Group>

      {vm.tenants.length > 0 && (
        <Select
          label="Target Tenant"
          data={vm.tenants.map((t) => ({
            value: t.tenantId,
            label: `${t.name} (${t.tenantId})`,
          }))}
          value={vm.selectedTenant}
          onChange={(value) => {
            if (value) {
              presenter.setTenant(value);
            }
          }}
        />
      )}

      {vm.models.length === 0 ? (
        <Alert color="yellow" title="No Models">
          No models synced for this project. Sync models first.
        </Alert>
      ) : (
        <Stack gap="xs">
          <Text fw={500}>Models</Text>
          {vm.models.map((model) => (
            <Card key={model.modelId} withBorder p="sm">
              <Group justify="space-between">
                <Checkbox
                  label={model.name}
                  checked={model.selected}
                  onChange={() => presenter.toggleModel(model.modelId)}
                />
                <Group gap="xs">
                  <Text size="sm" c="dimmed">
                    Entries:
                  </Text>
                  <NumberInput
                    value={model.amount}
                    onChange={(value) =>
                      presenter.setAmount(model.modelId, typeof value === "number" ? value : 10)
                    }
                    min={1}
                    max={10000}
                    w={100}
                    size="xs"
                    disabled={!model.selected}
                  />
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {vm.error && (
        <Alert color="red" title="Error">
          {vm.error}
        </Alert>
      )}

      {vm.seedResult && (
        <Alert color={vm.seedResult.errors > 0 ? "yellow" : "green"} title="Seeding Complete">
          <Group gap="md">
            <Badge color="green">{vm.seedResult.created} created</Badge>
            {vm.seedResult.errors > 0 && <Badge color="red">{vm.seedResult.errors} errors</Badge>}
          </Group>
        </Alert>
      )}

      <Button
        onClick={() => void presenter.seed()}
        loading={vm.isSeeding}
        disabled={vm.models.filter((m) => m.selected).length === 0}
        size="lg"
      >
        Seed Data
      </Button>
    </Stack>
  );
});
