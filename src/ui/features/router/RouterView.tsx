import type React from "react";
import { Box, Container, Stack, Text } from "@mantine/core";
import { useCurrentPath } from "./Router.js";
import { useContainer } from "~/ui/di/DiContainerProvider.js";
import { RouteRegistry } from "./abstractions/RouteRegistry.js";

export function RouterView(): React.ReactNode {
  const path = useCurrentPath();
  const container = useContainer();
  const registry = container.resolve(RouteRegistry);
  const result = registry.resolve({ path });

  if (!result) {
    return (
      <Container size="lg" py="md">
        <Stack align="center" mt="xl">
          <Text c="dimmed">Page not found.</Text>
        </Stack>
      </Container>
    );
  }

  const content = result.route.render(result.match);

  if (result.route.layout === "full") {
    return <Box p="md">{content}</Box>;
  }

  return (
    <Container size="lg" py="md">
      {content}
    </Container>
  );
}
