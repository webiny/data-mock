import { useState } from "react";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import type { ITenantVM } from "../abstractions/TenantsTabPresenter.js";

interface EditTenantTokenFormProps {
  tenant: ITenantVM;
  onSubmit: (apiToken: string) => Promise<boolean>;
  onCancel: () => void;
}

/** Sets or removes one tenant's own API token. */
export function EditTenantTokenForm({ tenant, onSubmit, onCancel }: EditTenantTokenFormProps) {
  const [apiToken, setApiToken] = useState(tenant.apiToken ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (apiToken === (tenant.apiToken ?? "")) {
      onCancel();
      return;
    }
    setIsSubmitting(true);
    await onSubmit(apiToken);
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <Stack gap="sm">
        <TextInput
          label="API token"
          description={
            tenant.keySource === "none"
              ? "Without a token this tenant is skipped by Pull Models and cannot be seeded."
              : "Leave empty to remove this tenant's own token."
          }
          value={apiToken}
          onChange={(event) => setApiToken(event.currentTarget.value)}
          autoComplete="off"
        />
        {tenant.keySource === "environment" && (
          <Text size="xs" c="dimmed">
            Uses the environment&apos;s main key until a token is set here.
          </Text>
        )}
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save Changes
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
