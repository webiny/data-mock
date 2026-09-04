import { createAbstraction } from "@webiny/stdlib";
import type { IGeneratorRegistry } from "../types.js";

export const GeneratorRegistry = createAbstraction<IGeneratorRegistry>(
  "Generators/GeneratorRegistry",
);

export namespace GeneratorRegistry {
  export type Interface = IGeneratorRegistry;
}
