import type React from "react";
import type { IRoute, IRouteMatch } from "./abstractions/Route.js";

interface DefineRouteConfig {
  name: string;
  path: string;
  layout?: "full" | "contained";
  render(params: Record<string, string>): React.ReactNode;
}

function buildMatcher(path: string): (pathname: string) => Record<string, string> | null {
  const paramNames: string[] = [];
  const hasWildcard = path.endsWith("/*");
  const basePath = hasWildcard ? path.slice(0, -2) : path;

  const regexSource = basePath.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName: string) => {
    paramNames.push(paramName);
    return "([^/]+)";
  });

  if (paramNames.length === 0 && !hasWildcard) {
    return (pathname: string) => (pathname === path ? {} : null);
  }

  const suffix = hasWildcard ? "(?:/(.*))?$" : "$";
  const regex = new RegExp(`^${regexSource}${suffix}`);

  return (pathname: string) => {
    const match = regex.exec(pathname);
    if (!match) {
      return null;
    }
    const params: Record<string, string> = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]!] = decodeURIComponent(match[i + 1]!);
    }
    if (hasWildcard) {
      params["_rest"] = match[paramNames.length + 1] ?? "";
    }
    return params;
  };
}

export function defineRoute(config: DefineRouteConfig): IRoute {
  const matchPath = buildMatcher(config.path);

  return {
    name: config.name,
    path: config.path,
    layout: config.layout ?? "contained",
    matchPath,
    render(match: IRouteMatch): React.ReactNode {
      return config.render(match.params);
    },
  };
}
