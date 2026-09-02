---
name: ui-developer
description: >
  Use when building UI features in src/ui/. Layered architecture: Gateway (HTTP) → Repository (state)
  → UseCase (logic) → Presenter (MobX vm) → React (display). React is dumb. All state and logic
  in TypeScript classes via DI. Invoke BEFORE writing any UI code. References project-architecture for DI patterns.
---

# UI Developer Guide

UI lives in `src/ui/`. Strict layered architecture — React is a dumb display layer. All state, logic, and data transformation live in plain TypeScript classes wired through `@webiny/di`. Shared types, errors, and domain models go in `src/shared/`.

## Layer Rules

```
React (display only) ← reads vm, calls actions
  ↑ useFeature() hook
Presenter (MobX observable) ← owns vm() getter, single source of UI truth
  ↑ DI constructor injection
UseCase (orchestration) ← all reads and writes
  ↑
Repository (plain class) ← holds domain state, NOT MobX observable
  ↑
Gateway (HTTP calls) ← translates API responses to domain types
```

| Layer | MobX | Holds state | React access | DI Scope |
|-------|------|-------------|--------------|----------|
| Gateway | No | No | Never | Singleton |
| Repository | No | Yes | Never | Singleton |
| UseCase | No | No | Never | Transient |
| Presenter | `makeAutoObservable` | Yes (derived) | Via `vm()` only | Transient |

### Result Pattern (no throws)

All layers use `Result<T, E>` from `@webiny/stdlib` — same as CLI. **Nothing throws.** Gateways catch HTTP errors and return `Result.fail()`. Use cases return `Result`. Presenters check `result.isOk()` / `result.isFail()` and update state accordingly. Presenters that trigger async work must use `try/finally` to reset loading state.

## Directory Structure

```
src/ui/
├── features/                    # Headless layer (Gateway + Repository)
│   └── {featureName}/
│       ├── abstractions/
│       │   ├── {Action}{Entity}Gateway.ts
│       │   ├── {Entity}Repository.ts
│       │   └── index.ts
│       ├── {Action}{Entity}Gateway.ts
│       ├── {Entity}Repository.ts
│       └── feature.ts
├── presentation/                # Presentation layer (Presenter + React)
│   └── {domain}/
│       └── {Page}/
│           ├── abstractions/
│           │   ├── {Page}Presenter.ts
│           │   └── index.ts
│           ├── useCases/
│           │   └── {Action}{Entity}/
│           │       ├── abstractions/
│           │       └── {Action}{Entity}UseCase.ts
│           ├── {Page}Presenter.ts
│           ├── {Page}Provider.tsx
│           ├── feature.ts
│           └── components/
│               ├── {Page}Page.tsx
│               └── {Feature}List.tsx
└── feature.ts                   # Root UiFeature
```

## Gateway — HTTP Only

Calls the backend API. Returns `Result<T, E>`.

```ts
// features/projects/abstractions/ProjectsGateway.ts
import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";

export interface IProjectDto {
  id: string;
  name: string;
  apiUrl: string;
}

export interface IProjectsGateway {
  getAll(): Promise<Result<IProjectDto[], ProjectsGateway.Error>>;
  create(input: ProjectsGateway.CreateInput): Promise<Result<IProjectDto, ProjectsGateway.Error>>;
}

export const ProjectsGateway = createAbstraction<IProjectsGateway>("Ui/ProjectsGateway");

export namespace ProjectsGateway {
  export type Interface = IProjectsGateway;
  export type ProjectDto = IProjectDto;
  export type CreateInput = { name: string; apiUrl: string; token: string };
  export type Error = import("../errors.ts").HttpError;
}
```

## Repository — Plain Class, NO MobX

Holds domain state. Exposes via getter methods. Singleton scope.

```ts
class ProjectsRepositoryImpl implements Abstraction.Interface {
  private projects: Abstraction.Project[] = [];

  public constructor(
    private readonly gateway: ProjectsGateway.Interface,
  ) {}

  public getProjects(): Abstraction.Project[] {
    return this.projects;
  }

  public async loadProjects(): Promise<Result<void, Abstraction.Error>> {
    const result = await this.gateway.getAll();
    if (result.isFail()) {
      return Result.fail(result.error);
    }
    this.projects = result.value;
    return Result.ok(undefined);
  }
}
```

## UseCase — Orchestration

Coordinates repositories. Transient scope. Presenters call use cases, never repositories or gateways directly.

## Presenter — The Only MobX Layer

Owns `vm()` getter. Maps domain state to view-ready data. Transient scope.

```ts
import { makeAutoObservable, runInAction, computed } from "mobx";

class ProjectListPresenterImpl implements Abstraction.Interface {
  private loading = false;

  public constructor(
    private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
  ) {
    makeAutoObservable(this, { vm: computed });
  }

  public get vm(): Abstraction.ViewModel {
    const projects = this.projectsRepository.getProjects();
    return {
      loading: this.loading,
      projects: projects.map(p => ({ id: p.id, name: p.name, apiUrl: p.apiUrl })),
      isEmpty: projects.length === 0,
    };
  }

  public load = async (): Promise<void> => {
    this.loading = true;
    try {
      await this.loadProjectsUseCase.execute();
    } finally {
      runInAction(() => { this.loading = false; });
    }
  };
}
```

Rules:
- `makeAutoObservable(this, { vm: computed })` in constructor
- `vm` is a computed getter returning a plain object with view-ready data
- All methods (except `vm`) are arrow function class properties (lexical `this`)
- Async mutations wrapped in `runInAction()`
- Presenter provides correct values — views never do `value ?? ""` or null coercion

## React — Display Only

Zero business logic. Zero data transformation. Reads `vm`, calls presenter actions.

```tsx
import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import type { ProjectListPresenter } from "../abstractions/ProjectListPresenter.ts";

interface ProjectListPageProps {
  presenter: ProjectListPresenter.Interface;
}

export const ProjectListPage = observer(function ProjectListPage({
  presenter
}: ProjectListPageProps) {
  const { vm } = presenter;

  useEffect(() => { presenter.load(); }, [presenter]);

  if (vm.loading) return <div>Loading...</div>;
  if (vm.isEmpty) return <div>No projects configured.</div>;

  return (
    <ul>
      {vm.projects.map(p => <li key={p.id}>{p.name} — {p.apiUrl}</li>)}
    </ul>
  );
});
```

## Provider

Connects DI to React via render props:

```tsx
import type React from "react";
import { useFeature } from "../../shared/di/useFeature.ts";
import { ProjectListFeature } from "./feature.ts";
import type { ProjectListPresenter } from "./abstractions/ProjectListPresenter.ts";

interface Props {
  children: (params: { presenter: ProjectListPresenter.Interface }) => React.ReactNode;
}

export function ProjectListProvider({ children }: Props) {
  const { presenter } = useFeature(ProjectListFeature);
  return children({ presenter });
}
```

## Anti-Patterns

| Wrong | Right |
|-------|-------|
| Component reads from repository | Component reads from `presenter.vm` |
| `makeAutoObservable` in repository | Only in presenter |
| Business logic in component | Move to presenter or use case |
| Presenter calls gateway/repository | All reads/writes through use cases |
| `useEffect` chain for business logic | Logic in presenter; useEffect only for load-on-mount |
| Class method `async load() {}` | Arrow property `load = async () => {}` |
| View does `value ?? ""` | Presenter provides view-ready values |
| Inline complex JSX | Extract into separate component files |
| Barrel exports implementation/feature | Barrel exports abstractions only |

## Feature Registration

UI features use `createFeature` from `@webiny/stdlib` with `dependencies` support for auto-registration.

```ts
import { createFeature } from "@webiny/stdlib";

export const ProjectsFeature = createFeature({
  name: "Ui/ProjectsFeature",
  register(container) {
    container.register(ProjectsGateway).inSingletonScope();
    container.register(ProjectsRepository).inSingletonScope();
  },
});
```
