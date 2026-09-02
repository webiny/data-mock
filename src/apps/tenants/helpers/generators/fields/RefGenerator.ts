import { BaseGenerator, BaseMultiGenerator } from "./BaseGenerator.js";
import { registry } from "../registry.js";

interface Ref {
  modelId: string;
  id: string;
  entryId: string;
}

class RefGenerator extends BaseGenerator<Ref> {
  public type = "ref";

  public async generate(): Promise<Ref | null> {
    return null;
  }
}

class MultiRefGenerator extends BaseMultiGenerator<Ref> {
  public type = "ref";

  public async generate(): Promise<Ref[] | null> {
    return null;
  }
}

registry.registerGenerator(RefGenerator);
registry.registerGenerator(MultiRefGenerator);
