import { useMemo } from "react";
import { useContainer } from "./DiContainerProvider.js";

interface Resolvable<TExports> {
  resolve(container: import("@webiny/di").Container): TExports;
}

export function useFeature<TExports>(feature: Resolvable<TExports>): TExports {
  const container = useContainer();
  return useMemo(() => feature.resolve(container), [container, feature]);
}
