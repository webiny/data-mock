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
  const regexSource = path.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName: string) => {
    paramNames.push(paramName);
    return "([^/]+)";
  });

  if (paramNames.length === 0) {
    return (pathname: string) => (pathname === path ? {} : null);
  }

  const regex = new RegExp(`^${regexSource}$`);

  return (pathname: string) => {
    const match = regex.exec(pathname);
    if (!match) {
      return null;
    }
    const params: Record<string, string> = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]!] = decodeURIComponent(match[i + 1]!);
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
