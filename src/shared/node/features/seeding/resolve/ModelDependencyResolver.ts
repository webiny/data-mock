import { Result } from "@webiny/stdlib";
import { ModelDependencyResolver as Abstraction } from "./abstractions/ModelDependencyResolver.js";
import type { ProjectModel, ApiCmsModelField } from "~/shared/types.js";

function extractRefModelIds(fields: ApiCmsModelField[]): string[] {
  const refs: string[] = [];

  function walk(fieldList: ApiCmsModelField[]): void {
    for (const field of fieldList) {
      if (field.type === "ref" && field.settings?.models) {
        const models = field.settings.models as Array<{ modelId: string }>;
        for (const refModel of models) {
          if (refModel.modelId) {
            refs.push(refModel.modelId);
          }
        }
      }

      if (field.type === "object" && Array.isArray(field.settings?.fields)) {
        walk(field.settings.fields as ApiCmsModelField[]);
      }

      if (field.type === "dynamicZone" && Array.isArray(field.settings?.templates)) {
        const templates = field.settings.templates as Array<{ fields?: ApiCmsModelField[] }>;
        for (const template of templates) {
          if (Array.isArray(template.fields)) {
            walk(template.fields);
          }
        }
      }
    }
  }

  walk(fields);
  return refs;
}

function detectCircularDependencies(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }
    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const deps = graph.get(node) ?? [];
    for (const dep of deps) {
      dfs(dep, [...path]);
    }

    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

function topologicalSort(
  models: ProjectModel[],
  graph: Map<string, string[]>,
  circularNodes: Set<string>,
): ProjectModel[] {
  const modelMap = new Map<string, ProjectModel>();
  for (const model of models) {
    modelMap.set(model.modelId, model);
  }

  const sorted: ProjectModel[] = [];
  const visited = new Set<string>();

  function visit(modelId: string): void {
    if (visited.has(modelId) || circularNodes.has(modelId)) {
      return;
    }
    visited.add(modelId);

    const deps = graph.get(modelId) ?? [];
    for (const dep of deps) {
      if (modelMap.has(dep) && !circularNodes.has(dep)) {
        visit(dep);
      }
    }

    const model = modelMap.get(modelId);
    if (model) {
      sorted.push(model);
    }
  }

  for (const model of models) {
    visit(model.modelId);
  }

  for (const model of models) {
    if (!sorted.includes(model)) {
      sorted.push(model);
    }
  }

  return sorted;
}

class ModelDependencyResolverImpl implements Abstraction.Interface {
  public execute(input: Abstraction.Input): Result<Abstraction.Output, Abstraction.Error> {
    const { models } = input;
    const availableModelIds = new Set(models.map((model) => model.modelId));

    const graph = new Map<string, string[]>();
    for (const model of models) {
      const refIds = extractRefModelIds(model.fields).filter((id) => availableModelIds.has(id));
      graph.set(model.modelId, refIds);
    }

    const circular = detectCircularDependencies(graph);
    const circularNodes = new Set<string>();
    for (const cycle of circular) {
      for (const node of cycle) {
        circularNodes.add(node);
      }
    }

    const ordered = topologicalSort(models, graph, circularNodes);

    return Result.ok({ ordered, circular });
  }
}

export const ModelDependencyResolver = Abstraction.createImplementation({
  implementation: ModelDependencyResolverImpl,
  dependencies: [],
});
