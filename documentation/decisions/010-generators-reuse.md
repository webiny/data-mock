# ADR-010: Reuse Generators, Rewrite to DI

**Date:** 2026-09-02
**Status:** Accepted

## Decision

The field generator system (`src/apps/tenants/helpers/generators/`) is battle-tested and must be preserved. Rewrite to DI — don't redesign.

## What Changes

- Global singleton registry → DI-scoped `GeneratorRegistry` abstraction
- Side-effect self-registration → explicit registration in `GeneratorFeature`
- `getGenerator`/`getGeneratorByField` injected via constructor, not passed as function args
- Validators follow the same pattern — register via DI, not global singletons

## What Stays the Same

- `BaseGenerator` / `BaseMultiGenerator` abstract classes
- All 11 field type generators (Text, Number, Boolean, DateTime, LongText, Json, File, RichText, Ref, Object, DynamicZone)
- All 5 validators (MinLength, MaxLength, Pattern, DateGte, DateLte)
- Recursive generation for Object and DynamicZone fields
- Validation-aware generation (generators respect CMS field validation rules)
- Date helpers (createDate, createTime, createDateTimeWithTimezone, createDateTimeWithoutTimezone)

## Target Location

```
src/generators/
├── abstractions/
│   └── GeneratorRegistry.ts
├── fields/                    # Per-type generators (ported)
├── validators/                # Per-rule validators (ported)
├── registry.ts                # Implementation
└── feature.ts                 # GeneratorFeature
```
