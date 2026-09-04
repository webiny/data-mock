import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { EncryptionService as Abstraction } from "./abstractions/EncryptionService.js";
import { EncryptionKey } from "./abstractions/EncryptionKey.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SEPARATOR = ":";

class EncryptionServiceImpl implements Abstraction.Interface {
  private readonly keyBuffer: Buffer | null;

  public constructor(private readonly encryptionKey: EncryptionKey.Interface) {
    if (!encryptionKey.key) {
      this.keyBuffer = null;
      return;
    }

    this.keyBuffer = Buffer.from(encryptionKey.key, "hex");

    if (this.keyBuffer.length !== 32) {
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
    const keyBuffer = this.ensureKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(
      SEPARATOR,
    );
  }

  public decrypt(ciphertext: string): string {
    const keyBuffer = this.ensureKey();
    const parts = ciphertext.split(SEPARATOR);
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted value format.");
    }

    const [ivBase64, authTagBase64, encryptedBase64] = parts;
    const iv = Buffer.from(ivBase64!, "base64");
    const authTag = Buffer.from(authTagBase64!, "base64");
    const encrypted = Buffer.from(encryptedBase64!, "base64");

    const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }
}

export const EncryptionService = Abstraction.createImplementation({
  implementation: EncryptionServiceImpl,
  dependencies: [EncryptionKey],
});
