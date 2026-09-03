import { createFeature } from "@webiny/stdlib";
import { ProjectRepository } from "../abstractions/ProjectRepository.js";
import { DatabaseClient } from "~/db/abstractions/DatabaseClient.js";
import { ProjectRepositoryImpl } from "../ProjectRepository.js";

export const ProjectRepositoryFeature = createFeature({
  name: "Shared/ProjectRepositoryFeature",
  register(container) {
    const databaseClient = container.resolve(DatabaseClient);
    const repository = new ProjectRepositoryImpl(databaseClient);
    container.registerInstance(ProjectRepository, repository);
  },
});
