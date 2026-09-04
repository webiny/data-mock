import { createFeature } from "@webiny/stdlib";
import { Command } from "./abstractions/Command.js";
import { Prompts } from "./Prompts.js";
import { UI } from "./UI.js";
import { AddProjectFeature } from "./commands/addProject/feature.js";
import { ListProjectsFeature } from "./commands/listProjects/feature.js";
import { RemoveProjectFeature } from "./commands/removeProject/feature.js";
import { InitFeature } from "./commands/init/feature.js";
import { SyncModelsFeature } from "./commands/syncModels/feature.js";
import { SeedFeature } from "./commands/seed/feature.js";
import { RotateKeyFeature } from "./commands/rotateKey/feature.js";
import { UploadFilesFeature } from "./commands/uploadFiles/feature.js";

export const CliFeature = createFeature({
  name: "Cli/CliFeature",
  register(container) {
    container.register(Prompts).inSingletonScope();
    container.register(UI).inSingletonScope();

    InitFeature.register(container);
    AddProjectFeature.register(container);
    ListProjectsFeature.register(container);
    RemoveProjectFeature.register(container);
    SyncModelsFeature.register(container);
    SeedFeature.register(container);
    RotateKeyFeature.register(container);
    UploadFilesFeature.register(container);
  },
});

export { Command };
