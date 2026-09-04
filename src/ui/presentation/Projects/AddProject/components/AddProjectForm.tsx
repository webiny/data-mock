import { observer } from "mobx-react-lite";
import { Alert, Button, Stack, TextInput } from "@mantine/core";
import type { AddProjectPresenter } from "../abstractions/AddProjectPresenter.js";

interface AddProjectFormProps {
  presenter: AddProjectPresenter.Interface;
  onSuccess: () => void;
}

export const AddProjectForm = observer(function AddProjectForm({
  presenter,
  onSuccess,
}: AddProjectFormProps) {
  const { name, apiUrl, apiToken, tenant, webinyVersion, isSubmitting, error } = presenter.vm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await presenter.submit();
    if (success) {
      onSuccess();
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <Stack gap="sm">
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <TextInput
          label="Name"
          placeholder="My Webiny Project"
          value={name}
          onChange={(e) => presenter.setName(e.currentTarget.value)}
          required
        />

        <TextInput
          label="API URL"
          placeholder="https://your-webiny-api.com"
          value={apiUrl}
          onChange={(e) => presenter.setApiUrl(e.currentTarget.value)}
          required
        />

        <TextInput
          label="API Token"
          placeholder="your-api-token"
          type="password"
          value={apiToken}
          onChange={(e) => presenter.setApiToken(e.currentTarget.value)}
          required
        />

        <TextInput
          label="Tenant"
          placeholder="root"
          value={tenant}
          onChange={(e) => presenter.setTenant(e.currentTarget.value)}
        />

        <TextInput
          label="Webiny Version"
          placeholder="6.0.0"
          value={webinyVersion}
          onChange={(e) => presenter.setWebinyVersion(e.currentTarget.value)}
        />

        <Button type="submit" loading={isSubmitting}>
          Add Project
        </Button>
      </Stack>
    </form>
  );
});
