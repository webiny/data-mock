import { createFeature } from "~/ui/di/createFeature.js";
import { TemplatesFeature } from "~/ui/features/templates/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { DeleteTemplateUseCase } from "./useCases/DeleteTemplate/DeleteTemplateUseCase.js";
import { TemplatesTabPresenter as Abstraction } from "./abstractions/TemplatesTabPresenter.js";
import { TemplatesTabPresenter } from "./TemplatesTabPresenter.js";

interface TemplatesTabExports {
  presenter: Abstraction.Interface;
}

export const TemplatesTabFeature = createFeature<void, TemplatesTabExports>({
  name: "Ui/TemplatesTabFeature",
  dependencies: [TemplatesFeature, NotificationsFeature],
  register(container) {
    container.register(DeleteTemplateUseCase);
    container.register(TemplatesTabPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
