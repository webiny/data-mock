import { createAbstraction } from "@webiny/stdlib";

export interface IEncryptionService {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

export const EncryptionService = createAbstraction<IEncryptionService>(
  "Encryption/EncryptionService",
);

export namespace EncryptionService {
  export type Interface = IEncryptionService;
}
