import { describe, it, expect } from "vitest";
import { Container } from "@webiny/di";
import { randomBytes } from "node:crypto";
import { EncryptionKey } from "../abstractions/EncryptionKey.js";
import { EncryptionService as Abstraction } from "../abstractions/EncryptionService.js";
import { EncryptionService } from "../EncryptionService.js";

function createEncryptionService(key?: string): Abstraction.Interface {
  const container = new Container();
  container.registerInstance(EncryptionKey, { key: key ?? randomBytes(32).toString("hex") });
  container.register(EncryptionService).inSingletonScope();
  return container.resolve(Abstraction);
}

describe("EncryptionService", () => {
  it("should encrypt and decrypt round-trip to the original text", () => {
    const service = createEncryptionService();
    const plaintext = "my-secret-api-token-abc123";

    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it("should produce different ciphertexts for the same plaintext", () => {
    const service = createEncryptionService();
    const plaintext = "same-input-different-output";

    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it("should produce different ciphertexts for different plaintexts", () => {
    const service = createEncryptionService();

    const encrypted1 = service.encrypt("first-secret");
    const encrypted2 = service.encrypt("second-secret");

    expect(encrypted1).not.toBe(encrypted2);
  });

  it("should fail to decrypt with a different key", () => {
    const key1 = randomBytes(32).toString("hex");
    const key2 = randomBytes(32).toString("hex");
    const service1 = createEncryptionService(key1);
    const service2 = createEncryptionService(key2);

    const encrypted = service1.encrypt("secret-token");

    expect(() => service2.decrypt(encrypted)).toThrow();
  });

  it("should encrypt and decrypt an empty string", () => {
    const service = createEncryptionService();
    const plaintext = "";

    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it("should produce output in the format iv:authTag:ciphertext", () => {
    const service = createEncryptionService();
    const encrypted = service.encrypt("test");

    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]!.length).toBeGreaterThan(0);
    expect(parts[1]!.length).toBeGreaterThan(0);
    expect(parts[2]!.length).toBeGreaterThan(0);
  });

  it("should throw for an invalid key length", () => {
    expect(() => createEncryptionService("tooshort")).toThrow(
      "ENCRYPTION_KEY must be a 64-character hex string",
    );
  });
});
