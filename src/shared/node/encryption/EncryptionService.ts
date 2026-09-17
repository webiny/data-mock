import { EncryptionService as Abstraction } from "./abstractions/EncryptionService.js";
import { EncryptionKey } from "./abstractions/EncryptionKey.js";
import { decryptWithKey, encryptWithKey, toKeyBuffer } from "./aesGcm.js";

class EncryptionServiceImpl implements Abstraction.Interface {
  private readonly keyBuffer: Buffer | null;

  public constructor(private readonly encryptionKey: EncryptionKey.Interface) {
    if (!encryptionKey.key) {
      this.keyBuffer = null;
      return;
    }

    try {
      this.keyBuffer = toKeyBuffer(encryptionKey.key);
    } catch {
      throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
    }
  }

  private ensureKey(): Buffer {
    if (!this.keyBuffer) {
      throw new Error("ENCRYPTION_KEY is not configured. Run 'yarn cli init' to generate one.");
    }
    return this.keyBuffer;
  }

  public encrypt(plaintext: string): string {
    return encryptWithKey(plaintext, this.ensureKey());
  }

  public decrypt(ciphertext: string): string {
    return decryptWithKey(ciphertext, this.ensureKey());
  }
}

export const EncryptionService = Abstraction.createImplementation({
  implementation: EncryptionServiceImpl,
  dependencies: [EncryptionKey],
});
