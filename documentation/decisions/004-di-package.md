# ADR-004: DI Package is @webiny/di (not @webiny/ioc)

**Date:** 2026-09-02
**Status:** Accepted

## Context

During initial research, some documents referenced `@webiny/ioc`. The actual published package is `@webiny/di` v1.0.2.

## Decision

Use `@webiny/di` everywhere. All references to `@webiny/ioc` have been corrected.

```ts
import { Container, Abstraction } from "@webiny/di";
import { createAbstraction, createFeature, Result, BaseError } from "@webiny/stdlib";
```

`@webiny/stdlib` re-exports `createAbstraction` as a convenience wrapper around `new Abstraction<T>()` from `@webiny/di`.
