import { createFeature } from "@webiny/stdlib";
import { GeneratorRegistry as Abstraction } from "./abstractions/GeneratorRegistry.js";
import { GeneratorRegistry } from "./registry.js";
import {
  TextGenerator,
  MultiTextGenerator,
  NumberGenerator,
  MultiNumberGenerator,
  BooleanGenerator,
  DateTimeGenerator,
  MultiDateTimeGenerator,
  LongTextGenerator,
  MultiLongTextGenerator,
  JsonGenerator,
  MultiJsonGenerator,
  FileGenerator,
  MultiFileGenerator,
  RichTextGenerator,
  MultiRichTextGenerator,
  RefGenerator,
  MultiRefGenerator,
  ObjectGenerator,
  MultiObjectGenerator,
  DynamicZoneGenerator,
  MultiDynamicZoneGenerator,
} from "./fields/index.js";
import {
  MinimumLengthValidator,
  MaximumLengthValidator,
  PatternValidator,
  GreaterThanOrEqualDateValidator,
  LesserThanOrEqualDateValidator,
} from "./validators/index.js";

export const GeneratorFeature = createFeature({
  name: "Generators/GeneratorFeature",
  register(container) {
    container.register(GeneratorRegistry).inSingletonScope();
    const registry = container.resolve(Abstraction);

    registry.registerValidator(MinimumLengthValidator);
    registry.registerValidator(MaximumLengthValidator);
    registry.registerValidator(PatternValidator);
    registry.registerValidator(GreaterThanOrEqualDateValidator);
    registry.registerValidator(LesserThanOrEqualDateValidator);

    registry.registerGenerator(TextGenerator);
    registry.registerGenerator(MultiTextGenerator);
    registry.registerGenerator(NumberGenerator);
    registry.registerGenerator(MultiNumberGenerator);
    registry.registerGenerator(BooleanGenerator);
    registry.registerGenerator(DateTimeGenerator);
    registry.registerGenerator(MultiDateTimeGenerator);
    registry.registerGenerator(LongTextGenerator);
    registry.registerGenerator(MultiLongTextGenerator);
    registry.registerGenerator(JsonGenerator);
    registry.registerGenerator(MultiJsonGenerator);
    registry.registerGenerator(FileGenerator);
    registry.registerGenerator(MultiFileGenerator);
    registry.registerGenerator(RichTextGenerator);
    registry.registerGenerator(MultiRichTextGenerator);
    registry.registerGenerator(RefGenerator);
    registry.registerGenerator(MultiRefGenerator);
    registry.registerGenerator(ObjectGenerator);
    registry.registerGenerator(MultiObjectGenerator);
    registry.registerGenerator(DynamicZoneGenerator);
    registry.registerGenerator(MultiDynamicZoneGenerator);
  },
});
