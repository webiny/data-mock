import { useState } from "react";
import { Button, Group, Stack, TextInput } from "@mantine/core";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";

interface EditProjectFormProps {
  project: NonNullable<ProjectDetailPresenter.VM["project"]>;
  onSubmit: (input: {
    name?: string;
    apiUrl?: string;
    apiToken?: string;
    tenant?: string;
    webinyVersion?: string;
  }) => Promise<boolean>;
  onCancel: () => void;
}

export function EditProjectForm({ project, onSubmit, onCancel }: EditProjectFormProps) {
  const [name, setName] = useState(project.name);
  const [apiUrl, setApiUrl] = useState(project.apiUrl);
  const [apiToken, setApiToken] = useState("");
  const [tenant, setTenant] = useState(project.tenant);
  const [webinyVersion, setWebinyVersion] = useState(project.webinyVersion);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const input: Record<string, string> = {};
    if (name !== project.name) {
      input.name = name;
    }
    if (apiUrl !== project.apiUrl) {
      input.apiUrl = apiUrl;
    }
    if (apiToken) {
      input.apiToken = apiToken;
    }
    if (tenant !== project.tenant) {
      input.tenant = tenant;
    }
    if (webinyVersion !== project.webinyVersion) {
      input.webinyVersion = webinyVersion;
    }

    if (Object.keys(input).length === 0) {
      onCancel();
      return;
    }

    await onSubmit(input);
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <Stack gap="sm">
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="API URL"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.currentTarget.value)}
          required
        />
        <TextInput
          label="API Token"
          type="password"
          value={apiToken}
          onChange={(e) => setApiToken(e.currentTarget.value)}
          placeholder="Leave blank to keep current token"
        />
        <TextInput
          label="Default Tenant"
          value={tenant}
          onChange={(e) => setTenant(e.currentTarget.value)}
        />
        <TextInput
          label="Webiny Version"
          value={webinyVersion}
          onChange={(e) => setWebinyVersion(e.currentTarget.value)}
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
