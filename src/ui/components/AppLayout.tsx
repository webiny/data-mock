import { AppShell, Group, Title, Text, Container } from "@mantine/core";

export function AppLayout() {
  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Title order={3}>Webiny Data Mock</Title>
          </Group>
          <Text size="sm" c="dimmed">
            Project Manager
          </Text>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="lg" py="md">
          <Text c="dimmed">Select a feature from the navigation to get started.</Text>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
