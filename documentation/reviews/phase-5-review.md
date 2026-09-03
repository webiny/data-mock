# Phase 5 Review — UI Layer

**Date:** 2026-09-03
**Reviewer:** Claude (automated)

## Summary

Architecture correctly follows Gateway → Repository → UseCase → Presenter → React pattern. MobX usage is correct. DI wiring within features is sound. Main gap: the app shell doesn't render any features yet — features exist but aren't wired into the app. 3 `as` casts violate project rules.

## Findings

### BUG

1. **`src/ui/App.tsx:10-13`** — createAppContainer only registers HTTPClientFeature. ProjectsFeature, ProjectListPresentationFeature, and AddProjectPresentationFeature are not registered. Features exist as dead code.

2. **`src/ui/features/projects/ProjectsGateway.ts:24,37`** — Two `as` casts to narrow response types. The HTTP client's request() should return properly typed responses from the route definition, or use Zod schemas from shared responses.

3. **`src/ui/infrastructure/httpClient/FetchHTTPClient.ts:78`** — `(await response.json()) as T` bypasses type checking. Route definition's response Zod schema is unused on the client side.

### IMPROVEMENT

4. **`src/ui/App.tsx`** — Should register presentation features and render project list/add forms.

5. **`src/ui/di/createFeature.ts:39`** — `context as TRegister` cast.

6. **`src/ui/infrastructure/httpClient/FetchHTTPClient.ts:62`** — `undefined as T` for 204 responses.

7. **`src/ui/features/projects/ProjectsRepository.ts:29`** — Exports class directly instead of through createImplementation, inconsistent with pattern.

8. **`src/ui/presentation/Projects/AddProject/AddProjectPresenter.ts:49-52`** — Client-side validation fine for UX but should also handle API validation errors.

### STYLE

9. **`src/ui/infrastructure/httpClient/abstractions/HTTPClient.ts:19-30`** — HTTPError defined in same file as HTTPClient abstraction. Should be in separate file per iron rule.

### MISSING

10. **No client-side routing.** No React Router or similar for navigating between views.

11. **No UI tests.** Presenters and use cases are testable plain classes — high value to test.

12. **Feature registration not wired.** Features are dead code until App.tsx registers them and AppLayout renders them.
