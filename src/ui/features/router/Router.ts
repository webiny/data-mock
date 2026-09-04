import { useEffect, useState } from "react";

export function navigate(path: string): void {
  const current = window.location.pathname + window.location.search;
  if (current === path) {
    return;
  }
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function navigateWithQuery(params: Record<string, string | null>): void {
  const search = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === "") {
      search.delete(key);
    } else {
      search.set(key, value);
    }
  }
  const qs = search.toString();
  const url = window.location.pathname + (qs ? `?${qs}` : "");
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function getSearchParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

export function useCurrentPath(): string {
  const [path, setPath] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    function handlePopState(): void {
      setPath(window.location.pathname);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return path;
}
