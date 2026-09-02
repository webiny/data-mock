# ADR-011: Thin Routes

**Date:** 2026-09-02
**Status:** Accepted

## Decision

Routes are thin. They take input and pass it to use cases. No business logic in route handlers.

## Pattern

```ts
// route.ts
export const createProjectRoute = routeFactory(createProjectRouteDef, async ({ body, container, send }) => {
  const useCase = container.resolve(CreateProjectUseCase);
  const result = await useCase.execute(body);
  return send(result);
});
```

## What Routes Do
- Extract params/body/query from the request
- Resolve a use case from the DI container
- Call `useCase.execute(input)`
- Send the result via typed `send()`

## What Routes Do NOT Do
- Validation (handled by Zod schemas in route definitions)
- Authorization (handled by middleware — N/A for localhost, see ADR-006)
- Business logic (belongs in use cases)
- Database queries (belong in repositories)
- External API calls (belong in gateways/services)

## Flow

```
Route → UseCase → Repository/Service/Gateway → Result → send()
```
