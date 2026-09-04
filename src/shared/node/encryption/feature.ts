import { createFeature } from "@webiny/stdlib";
import { EncryptionKey } from "./abstractions/EncryptionKey.js";
import { EncryptionService } from "./EncryptionService.js";
import { KeyRotationService } from "./KeyRotationService.js";

interface IEncryptionFeatureContext {
  readonly encryptionKey: string;
}

export const EncryptionFeature = createFeature<IEncryptionFeatureContext>({
  name: "Encryption/EncryptionFeature",
  register(container, context) {
    container.registerInstance(EncryptionKey, { key: context.encryptionKey });
    container.register(EncryptionService).inSingletonScope();
    container.register(KeyRotationService).inSingletonScope();
  },
});
