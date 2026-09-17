import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SEPARATOR = ":";
const KEY_LENGTH = 32;

/**
 * The on-disk format for an encrypted API token: `iv:authTag:ciphertext`, each part base64.
 *
 * One implementation, two callers. `EncryptionService` encrypts with the key the container was
 * given; `KeyRotationService` decrypts with one key and re-encrypts with another. Written twice,
 * the two copies could drift — and the way that shows up is a rotation that reads every stored
 * token as corrupt, or worse, writes something the reader cannot decrypt.
 */
export function toKeyBuffer(keyHex: string): Buffer {
  const keyBuffer = Buffer.from(keyHex, "hex");
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error("Encryption key must be a 64-character hex string (32 bytes).");
  }
  return keyBuffer;
}

export function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(
    SEPARATOR,
  );
}

export function decryptWithKey(ciphertext: string, key: Buffer): string {
  const parts = ciphertext.split(SEPARATOR);
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format.");
  }

  const iv = Buffer.from(parts[0]!, "base64");
  const authTag = Buffer.from(parts[1]!, "base64");
  const encrypted = Buffer.from(parts[2]!, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
