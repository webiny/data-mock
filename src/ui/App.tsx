import { useMemo } from "react";
import { Container } from "@webiny/di";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { DiContainerProvider } from "./di/DiContainerProvider.js";
import { HTTPClientFeature } from "./infrastructure/httpClient/feature.js";
import { ProjectsFeature } from "./features/projects/feature.js";
import { TenantsFeature } from "./features/tenants/feature.js";
import { ModelsFeature } from "./features/models/feature.js";
import { SeedingFeature } from "./features/seeding/feature.js";
import { ProjectListPresentationFeature } from "./presentation/Projects/ProjectList/feature.js";
import { AddProjectPresentationFeature } from "./presentation/Projects/AddProject/feature.js";
import { SeedConfigPresentationFeature } from "./presentation/Seeding/SeedConfig/feature.js";
import { SeedHistoryPresentationFeature } from "./presentation/Seeding/SeedHistory/feature.js";
import { AppLayout } from "./components/AppLayout.js";
import { theme } from "./theme/theme.js";

function createAppContainer(): Container {
  const container = new Container();
  HTTPClientFeature.register(container, { baseUrl: "" });
  ProjectsFeature.register(container);
  TenantsFeature.register(container);
  ModelsFeature.register(container);
  SeedingFeature.register(container);
  ProjectListPresentationFeature.register(container);
  AddProjectPresentationFeature.register(container);
  SeedConfigPresentationFeature.register(container);
  SeedHistoryPresentationFeature.register(container);
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
