import { useState } from "react";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import type { IProjectVM, IEditProjectInput } from "../abstractions/ProjectDetailPresenter.js";

interface EditProjectFormProps {
  project: IProjectVM;
  onSubmit: (input: IEditProjectInput) => Promise<boolean>;
  onCancel: () => void;
}

/**
 * Edits the project — the system on disk. Connection details (API URL, token, tenant) belong to an
 * environment now and are edited there, because a project can have several.
 */
export function EditProjectForm({ project, onSubmit, onCancel }: EditProjectFormProps) {
  const [name, setName] = useState(project.name);
  const [rootPath, setRootPath] = useState(project.rootPath ?? "");
  const [operationsVersion, setOperationsVersion] = useState(project.operationsVersion);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const input: IEditProjectInput = {};
    if (name !== project.name) {
      input.name = name;
    }
    if (rootPath !== (project.rootPath ?? "")) {
      // An emptied path means the project is remote-only again, which is null rather than "".
      input.rootPath = rootPath === "" ? null : rootPath;
    }
    if (operationsVersion !== project.operationsVersion) {
      input.operationsVersion = operationsVersion;
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
          label="Name"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          required
        />
        <TextInput
          label="Project path"
          description="Absolute path to the Webiny checkout. Leave blank for a remote-only project."
          placeholder="/Users/you/work/my-webiny-project"
          value={rootPath}
          onChange={(event) => setRootPath(event.currentTarget.value)}
        />
        <TextInput
          label="Operations version"
          description="Selects the GraphQL operation set. Detected on sync; override only if wrong."
          value={operationsVersion}
          onChange={(event) => setOperationsVersion(event.currentTarget.value)}
        />
        <Text size="xs" c="dimmed">
          Detected version: {project.webinyVersion ?? "workspace root — built from source"}
        </Text>
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
