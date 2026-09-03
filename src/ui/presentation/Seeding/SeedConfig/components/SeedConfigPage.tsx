import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Loader,
  NumberInput,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
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

  const selectedCount = vm.groups.reduce(
    (acc, g) => acc + g.models.filter((m) => m.selected).length,
    0,
  );

  return (
    <Stack gap="lg">
      <Title order={3}>Seed Data — {vm.project?.name}</Title>

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

      {vm.groups.length === 0 ? (
        <Alert color="yellow" title="No Models">
          No models synced for this project. Sync models first.
        </Alert>
      ) : (
        <>
          <Group justify="space-between">
            <Text fw={500}>Models</Text>
            <Group gap="xs">
              <Button variant="subtle" size="compact-xs" onClick={() => presenter.selectAll()}>
                Select All
              </Button>
              <Button variant="subtle" size="compact-xs" onClick={() => presenter.deselectAll()}>
                Deselect All
              </Button>
            </Group>
          </Group>

          <Accordion variant="separated" multiple defaultValue={vm.groups.map((g) => g.slug)}>
            {vm.groups.map((group) => (
              <Accordion.Item key={group.slug} value={group.slug}>
                <Accordion.Control>
                  <Group justify="space-between" pr="xs">
                    <Text fw={500}>{group.name}</Text>
                    <Group gap="xs">
                      <Badge size="sm" variant="light">
                        {group.models.length} models
                      </Badge>
                      <Checkbox
                        checked={group.allSelected}
                        onChange={() => presenter.toggleGroup(group.slug)}
                        onClick={(e) => e.stopPropagation()}
                        size="xs"
                      />
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {group.models.map((model) => (
                      <Card key={model.modelId} withBorder p="sm">
                        <Group justify="space-between" wrap="nowrap">
                          <Checkbox
                            label={model.name}
                            checked={model.selected}
                            onChange={() => presenter.toggleModel(model.modelId)}
                          />
                          <Group gap="xs" wrap="nowrap">
                            <Text size="xs" c="dimmed">
                              Entries:
                            </Text>
                            <NumberInput
                              value={model.amount}
                              onChange={(value) =>
                                presenter.setAmount(
                                  model.modelId,
                                  typeof value === "number" ? value : 10,
                                )
                              }
                              min={1}
                              max={100000}
                              w={90}
                              size="xs"
                              disabled={!model.selected}
                            />
                            <Text size="xs" c="dimmed">
                              Revisions:
                            </Text>
                            <TextInput
                              value={model.revisions}
                              onChange={(e) =>
                                presenter.setRevisions(model.modelId, e.currentTarget.value)
                              }
                              placeholder="1 or 1-5"
                              w={80}
                              size="xs"
                              disabled={!model.selected}
                            />
                          </Group>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </>
      )}

      <Divider label="Publish Strategy" labelPosition="left" />

      <Select
        label="After creating entries"
        data={[
          { value: "none", label: "Do not publish" },
          { value: "all", label: "Publish all entries" },
          { value: "random", label: "Publish randomly (by percentage)" },
          { value: "first", label: "Publish first revision only" },
          { value: "last", label: "Publish last revision only" },
        ]}
        value={vm.publishStrategy}
        onChange={(value) => {
          if (value) {
            presenter.setPublishStrategy(value as "none" | "all" | "random" | "first" | "last");
          }
        }}
      />

      {vm.publishStrategy === "random" && (
        <Stack gap="xs">
          <Text size="sm">Publish percentage: {vm.publishPercent}%</Text>
          <Slider
            value={vm.publishPercent}
            onChange={(value) => presenter.setPublishPercent(value)}
            min={0}
            max={100}
            step={5}
            marks={[
              { value: 0, label: "0%" },
              { value: 50, label: "50%" },
              { value: 100, label: "100%" },
            ]}
          />
        </Stack>
      )}

      {vm.publishStrategy !== "none" && (
        <Switch
          label="Include unpublish cycles"
          description="Some entries get published then unpublished (simulates real lifecycle)"
          checked={vm.includeUnpublish}
          onChange={(e) => presenter.setIncludeUnpublish(e.currentTarget.checked)}
        />
      )}

      <Divider />

      <Switch
        label="Dry run"
        description="Generate entries without sending them to Webiny"
        checked={vm.dryRun}
        onChange={(e) => presenter.setDryRun(e.currentTarget.checked)}
      />

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
        disabled={selectedCount === 0}
        size="lg"
      >
        {vm.dryRun ? "Dry Run" : "Seed Data"} ({selectedCount} models)
      </Button>
    </Stack>
  );
});
