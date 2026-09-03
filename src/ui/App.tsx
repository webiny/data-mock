import { useMemo } from "react";
import { Container } from "@webiny/di";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { DiContainerProvider } from "./di/DiContainerProvider.js";
import { HTTPClientFeature } from "./infrastructure/httpClient/feature.js";
import { RouterFeature } from "./features/router/feature.js";
import { NotificationsFeature } from "./features/notifications/feature.js";
import { ProjectsFeature } from "./features/projects/feature.js";
import { TenantsFeature } from "./features/tenants/feature.js";
import { ModelsFeature } from "./features/models/feature.js";
import { SeedingFeature } from "./features/seeding/feature.js";
import { ProjectListPresentationFeature } from "./presentation/Projects/ProjectList/feature.js";
import { AddProjectPresentationFeature } from "./presentation/Projects/AddProject/feature.js";
import { SeedConfigPresentationFeature } from "./presentation/Seeding/SeedConfig/feature.js";
import { SeedHistoryPresentationFeature } from "./presentation/Seeding/SeedHistory/feature.js";
import { ProjectDetailPresentationFeature } from "./presentation/Projects/ProjectDetail/feature.js";
import { TemplatesFeature } from "./features/templates/feature.js";
import { AppLayout } from "./components/AppLayout.js";
import { theme } from "./theme/theme.js";

function createAppContainer(): Container {
  const container = new Container();
  HTTPClientFeature.register(container, { baseUrl: "" });
  RouterFeature.register(container);
  NotificationsFeature.register(container);
  ProjectsFeature.register(container);
  TenantsFeature.register(container);
  ModelsFeature.register(container);
  SeedingFeature.register(container);
  TemplatesFeature.register(container);
  ProjectListPresentationFeature.register(container);
  ProjectDetailPresentationFeature.register(container);
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
        <Notifications position="top-right" />
        <AppLayout />
      </MantineProvider>
    </DiContainerProvider>
  );
}
