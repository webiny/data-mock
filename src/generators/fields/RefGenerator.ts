import { BaseGenerator, BaseMultiGenerator } from "./BaseGenerator.js";

interface Ref {
  modelId: string;
  id: string;
  entryId: string;
}

export class RefGenerator extends BaseGenerator<Ref> {
  public type = "ref";

  public async generate(): Promise<Ref | null> {
    return null;
  }
}

export class MultiRefGenerator extends BaseMultiGenerator<Ref> {
  public type = "ref";

  public async generate(): Promise<Ref[] | null> {
    return null;
  }
}
