import { createAbstraction } from "@webiny/stdlib";

export interface IEncryptionKey {
  readonly key: string;
}

export const EncryptionKey = createAbstraction<IEncryptionKey>("Encryption/EncryptionKey");

export namespace EncryptionKey {
  export type Interface = IEncryptionKey;
}
