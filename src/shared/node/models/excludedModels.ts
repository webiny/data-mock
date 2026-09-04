const EXCLUDED_MODEL_PREFIXES = ["wby"];

const EXCLUDED_MODEL_IDS = new Set([
  "backgroundTaskSettings",
  "backgroundTask",
  "backgroundTaskLog",
]);

export function isExcludedModel(modelId: string): boolean {
  if (EXCLUDED_MODEL_IDS.has(modelId)) {
    return true;
  }
  return EXCLUDED_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix));
}
