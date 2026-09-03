import { useMemo } from "react";
import { Container } from "@webiny/di";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { DiContainerProvider } from "./di/DiContainerProvider.js";
import { HTTPClientFeature } from "./infrastructure/httpClient/feature.js";
import { AppLayout } from "./components/AppLayout.js";
import { theme } from "./theme/theme.js";

function createAppContainer(): Container {
  const container = new Container();
  HTTPClientFeature.register(container, { baseUrl: "" });
  return container;
}

export function App() {
  const container = useMemo(() => createAppContainer(), []);

  return (
    <DiContainerProvider container={container}>
      <MantineProvider theme={theme}>
        <AppLayout />
      </MantineProvider>
    </DiContainerProvider>
  );
}
