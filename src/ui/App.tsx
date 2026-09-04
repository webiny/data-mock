import { useMemo } from "react";
import { Container } from "@webiny/di";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dropzone/styles.css";
import { DiContainerProvider } from "./di/DiContainerProvider.js";
import { HTTPClientFeature } from "./infrastructure/httpClient/feature.js";
import { RouterFeature } from "./features/router/feature.js";
import { URLListStateFeature } from "./features/router/URLListStateFeature.js";
import { Route } from "./features/router/abstractions/Route.js";
import { NotificationsFeature } from "./features/notifications/feature.js";
import { EventsFeature } from "./infrastructure/events/feature.js";
import { WebSocketFeature } from "./infrastructure/websocket/feature.js";
import { ProjectsFeature } from "./features/projects/feature.js";
import { TenantsFeature } from "./features/tenants/feature.js";
import { ModelsFeature } from "./features/models/feature.js";
import { SeedingFeature } from "./features/seeding/feature.js";
import { TemplatesFeature } from "./features/templates/feature.js";
import { LocalFilesFeature } from "./features/localFiles/feature.js";
import { ProjectListPresentationFeature } from "./presentation/Projects/ProjectList/feature.js";
import { AddProjectPresentationFeature } from "./presentation/Projects/AddProject/feature.js";
import { SeedConfigPresentationFeature } from "./presentation/Seeding/SeedConfig/feature.js";
import { SeedHistoryPresentationFeature } from "./presentation/Seeding/SeedHistory/feature.js";
import { ProjectDetailPresentationFeature } from "./presentation/Projects/ProjectDetail/feature.js";
import { FileManagerPresentationFeature } from "./presentation/FileManager/feature.js";
import { projectListRoute } from "./presentation/Projects/ProjectList/route.js";
import { projectDetailRoute } from "./presentation/Projects/ProjectDetail/route.js";
import { fileManagerRoute } from "./presentation/FileManager/route.js";
import { AppLayout } from "./components/AppLayout.js";
import { theme } from "./theme/theme.js";

function createAppContainer(): Container {
  const container = new Container();

  HTTPClientFeature.register(container, { baseUrl: "" });
  RouterFeature.register(container);
  URLListStateFeature.register(container);
  NotificationsFeature.register(container);
  EventsFeature.register(container);
  WebSocketFeature.register(container);

  ProjectsFeature.register(container);
  TenantsFeature.register(container);
  ModelsFeature.register(container);
  SeedingFeature.register(container);
  TemplatesFeature.register(container);
  LocalFilesFeature.register(container);

  ProjectListPresentationFeature.register(container);
  ProjectDetailPresentationFeature.register(container);
  AddProjectPresentationFeature.register(container);
  SeedConfigPresentationFeature.register(container);
  SeedHistoryPresentationFeature.register(container);
  FileManagerPresentationFeature.register(container);

  container.registerInstance(Route, projectListRoute);
  container.registerInstance(Route, projectDetailRoute);
  container.registerInstance(Route, fileManagerRoute);

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
