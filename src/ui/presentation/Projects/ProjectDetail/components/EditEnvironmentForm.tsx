import { useState } from "react";
import { Button, Group, Stack, TextInput } from "@mantine/core";
import type {
  IEditEnvironmentInput,
  IEnvironmentVM,
} from "../abstractions/ProjectDetailPresenter.js";

interface EditEnvironmentFormProps {
  environment: IEnvironmentVM;
  onSubmit: (input: IEditEnvironmentInput) => Promise<boolean>;
  onCancel: () => void;
}

/** Edits one environment's connection details. */
export function EditEnvironmentForm({ environment, onSubmit, onCancel }: EditEnvironmentFormProps) {
  const [apiUrl, setApiUrl] = useState(environment.apiUrl ?? "");
  const [apiToken, setApiToken] = useState(environment.apiToken ?? "");
  const [tenant, setTenant] = useState(environment.tenant);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const input: IEditEnvironmentInput = {};
    if (apiUrl !== (environment.apiUrl ?? "")) {
      // An emptied url means the environment has no API to talk to, which is null rather than "".
      input.apiUrl = apiUrl === "" ? null : apiUrl;
    }
    if (apiToken !== (environment.apiToken ?? "")) {
      // An emptied token removes the stored one, which is null rather than "".
      input.apiToken = apiToken === "" ? null : apiToken;
    }
    if (tenant !== environment.tenant) {
      input.tenant = tenant;
    }

    if (Object.keys(input).length === 0) {
      onCancel();
      return;
    }

    await onSubmit(input);
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <Stack gap="sm">
        <TextInput
          label="API URL"
          description="Base url of the api app, not a /cms/manage endpoint."
          placeholder="https://xxxxxxxx.cloudfront.net"
          value={apiUrl}
          onChange={(event) => setApiUrl(event.currentTarget.value)}
        />
        <TextInput
          label="API token"
          value={apiToken}
          onChange={(event) => setApiToken(event.currentTarget.value)}
          autoComplete="off"
        />
        <TextInput
          label="Tenant"
          value={tenant}
          onChange={(event) => setTenant(event.currentTarget.value)}
          required
        />
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
