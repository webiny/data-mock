export function interpolatePath(path: string, params: Record<string, string>): string {
  return path.replace(/:([a-zA-Z0-9_]+)/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined) {
      throw new Error(`interpolatePath: missing value for param "${key}" in path "${path}"`);
    }
    return encodeURIComponent(value);
  });
}
