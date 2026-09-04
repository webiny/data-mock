import { createContext, useContext, type ReactNode } from "react";
import type { Container } from "@webiny/di";

const ContainerContext = createContext<Container | null>(null);

interface DiContainerProviderProps {
  container: Container;
  children: ReactNode;
}

export function DiContainerProvider({ container, children }: DiContainerProviderProps) {
  return <ContainerContext value={container}>{children}</ContainerContext>;
}

export function useContainer(): Container {
  const container = useContext(ContainerContext);
  if (!container) {
    throw new Error("useContainer must be used within a DiContainerProvider");
  }
  return container;
}
