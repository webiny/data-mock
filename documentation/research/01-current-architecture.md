# Current Architecture — webiny-mock-data

## Project Overview

A CLI tool that creates mock data in a Webiny CMS instance via its GraphQL API. It creates groups, models, entries, folders, and tenants, and supports fetching existing entries for export. Uses `@faker-js/faker` for data generation and a file-based caching system for repeated runs.

**Entry point**: `index.js` (registers tsx, imports `src/index.ts`)
**Runtime**: Node.js ESM (`"type": "module"` in package.json), TypeScript 7 compiled with `tsc`, executed via `tsx`.

---

## 1. Project Structure

```
.
├── index.js                         # Bootstrap: registers tsx/esm, imports src/index.ts
├── package.json
├── tsconfig.json                    # ESNext + nodenext module, path alias ~/*, outDir dist/
├── .gitignore                       # Ignores .env*, dist/, node_modules, dryRuns/, .cache
├── .oxlintrc.json                   # oxlint config
├── src/
│   ├── index.ts                     # CLI entry — parses argv via yargs, creates Application, runs it
│   ├── types.ts                     # All shared TypeScript interfaces and types
│   ├── logger.ts                    # pino + pino-pretty logger singleton
│   ├── base/
│   │   └── Application.ts           # Root application — orchestrator, env loader, app registry
│   ├── errors/
│   │   ├── GraphQLError.ts          # HTTP-aware error with code + data
│   │   ├── NotFoundError.ts         # Simple extends Error
│   │   └── index.ts                 # Re-exports
│   ├── cache/
│   │   ├── types.ts                 # ICache, ICacheKey, ICacheKeyInput interfaces
│   │   ├── CacheKey.ts              # SHA-256 hash-based cache key
│   │   ├── FileCache.ts             # JSON file-based cache with TTL
│   │   ├── MemoryCache.ts           # In-memory Map-based cache
│   │   └── index.ts                 # Re-exports + createFileCache, createMemoryCache
│   ├── apps/
│   │   ├── GraphQLApplication.ts    # HTTP client for Webiny GraphQL API
│   │   ├── GroupApplication.ts      # Creates CMS content model groups
│   │   ├── ModelApplication.ts      # Creates CMS content models
│   │   ├── EntryApplication.ts      # Creates CMS entries (orchestrates runners)
│   │   ├── FetchEntriesApplication.ts # Paginated entry fetcher + JSON export
│   │   ├── FolderApplication.ts     # Creates ACO folders (currently commented out)
│   │   ├── cms/
│   │   │   ├── index.ts             # Re-exports all CMS data definitions
│   │   │   ├── types.ts             # CmsGroup, CmsModel, CmsModelField types
│   │   │   ├── createGetCmsContentResult.ts  # Generic GraphQL result parser
│   │   │   ├── group/
│   │   │   │   ├── types.ts         # CmsGroup type
│   │   │   │   ├── blog.ts          # Blog group definition
│   │   │   │   └── cars.ts          # Cars group definition
│   │   │   ├── model/
│   │   │   │   ├── types.ts         # CmsModel, CmsModelField types
│   │   │   │   ├── blog.ts          # Category, Author, Article model defs
│   │   │   │   └── simpleCars.ts    # SimpleCarMake, SimpleCarModel defs
│   │   │   └── entry/
│   │   │       ├── blog.ts          # Blog entry runner (categories, authors, articles)
│   │   │       ├── simpleCars.ts    # Simple cars entry runner
│   │   │       └── carsList.ts      # Static car brand/model data (1000+ entries)
│   │   ├── folder/
│   │   │   ├── folders.ts           # Folder runner (page folders + hierarchical structure)
│   │   │   └── getAcoFolderResult.ts # ACO folder GraphQL result parser
│   │   ├── tenants/
│   │   │   ├── TenantsApplication.ts        # Creates/lists tenants via GraphQL
│   │   │   ├── EntryPerTenantApplication.ts # Bulk entry creation per tenant per model
│   │   │   └── helpers/
│   │   │       ├── createEntryVariables.ts  # Generates mock entry data using generators
│   │   │       └── generators/
│   │   │           ├── index.ts     # Exports getGenerator() — registry entry point
│   │   │           ├── registry.ts  # Generator + validator registry singleton
│   │   │           ├── types.ts     # IGenerator, IValidator, IRegistry interfaces
│   │   │           ├── fields/
│   │   │           │   ├── index.ts           # Side-effect imports all generators
│   │   │           │   ├── BaseGenerator.ts   # Abstract base class (single + multi)
│   │   │           │   ├── TextGenerator.ts
│   │   │           │   ├── NumberGenerator.ts
│   │   │           │   ├── BooleanGenerator.ts
│   │   │           │   ├── DateGenerator.ts
│   │   │           │   ├── LongTextGenerator.ts
│   │   │           │   ├── JsonGenerator.ts
│   │   │           │   ├── FileGenerator.ts
│   │   │           │   ├── RichTextGenerator.ts
│   │   │           │   ├── RefGenerator.ts    # Returns null (refs not auto-generated)
│   │   │           │   ├── ObjectGenerator.ts # Recursive: generates nested fields
│   │   │           │   ├── DynamicZoneGenerator.ts # Template-based generation
│   │   │           │   └── date/
│   │   │           │       ├── types.ts
│   │   │           │       ├── createDate.ts
│   │   │           │       ├── createTime.ts
│   │   │           │       ├── createDateTimeWithoutTimezone.ts
│   │   │           │       └── createDateTimeWithTimezone.ts
│   │   │           └── validators/
│   │   │               ├── index.ts            # Re-exports + side-effect registrations
│   │   │               ├── types.ts            # Validation settings types
│   │   │               ├── BaseValidator.ts    # Abstract base with zod schema validation
│   │   │               ├── MinimumLengthValidator.ts
│   │   │               ├── MaximumLengthValidator.ts
│   │   │               ├── PatternValidator.ts
│   │   │               ├── GreaterThanOrEqualDateValidator.ts
│   │   │               └── LesserThanOrEqualDateValidator.ts
│   │   └── utils/
│   │       ├── createModelFields.ts  # Generates GraphQL field selections from model
│   │       └── fields/
│   │           ├── index.ts          # Builds type → definition map
│   │           ├── createField.ts    # Factory function for field definitions
│   │           ├── text.ts
│   │           ├── number.ts
│   │           ├── boolean.ts
│   │           ├── datetime.ts
│   │           ├── file.ts
│   │           ├── json.ts
│   │           ├── longText.ts       # Actually exports createRichTextField
│   │           ├── richText.ts       # Actually exports createLongTextField
│   │           └── ref.ts            # Adds {id entryId modelId} subselection
```

---

## 2. Environment Variables (.env)

**Loaded in**: `src/base/Application.ts` → `getEnv()` function (line 13-27)
**Method**: `dotenv.config()` — loads from `.env` in project root

| Variable | Required | Purpose |
|---|---|---|
| `API_GRAPHQL_URL` | Yes | Base URL of Webiny's GraphQL API |
| `API_TOKEN` | Yes | Bearer authentication token |

Both are validated at startup — the app throws if either is missing.

**Consumed by**: `GraphQLApplication` constructor, which uses them to set:
- `this.url` — base URL for all API requests
- `Authorization: Bearer ${token}` header
- `x-tenant` header (defaults to `"root"`, configurable via `--tenant` CLI arg)

---

## 3. Application Base Class (`src/base/Application.ts`)

The root `Application` class is the orchestrator. It:

1. **Loads environment** — calls `getEnv()` which reads `.env`
2. **Creates sub-applications** — instantiates all domain applications with itself as dependency
3. **Provides shared services** — `graphql` (HTTP client) and `cache` (file cache)
4. **Routes CLI commands** — inspects boolean args to decide which flow to run

### Constructor Flow
```
new Application(argv)
  → dotenv.config()
  → new GraphQLApplication({ url, token, tenant })
  → new GroupApplication(this)
  → new ModelApplication(this)
  → new EntryApplication(this)
  → new FetchEntriesApplication(this)
  → new TenantsApplication(this)
  → new EntryPerTenantApplication(this)
  → createFileCache({ cacheDir })
```

### Command Routing (`run()`)
| CLI Flag | Execution Path |
|---|---|
| `--create-data` | group → model → entry (sequential) |
| `--fetch-data` | fetcher.run() |
| `--create-tenants` | tenants.run() |
| `--create-data-per-tenant` | entryPerTenant.run() |

### Argument Helpers
- `getBooleanArg(name, default)` — reads from argv
- `getNumberArg(name, default)` — parses number, returns default if NaN or ≤ 0
- `getStringArg(name, default)` — coerces to string
- `getApp<T>(name)` — typed lookup from the apps registry

### Key Interface: `IBaseApplication`
```typescript
interface IBaseApplication {
  run(): Promise<void>;
  getBooleanArg(name: string, def: boolean): boolean;
  getNumberArg(name: string, def: number): number;
  getStringArg(name: string, def: string): string;
  getApp<T>(name: string): T;
  graphql: IGraphQLApplication;
  cache: ICache;
}
```

All sub-applications receive `IBaseApplication` and use it to access shared services and other applications.

---

## 4. Concrete Applications

### 4a. GraphQLApplication (`src/apps/GraphQLApplication.ts`)

The HTTP client for Webiny's GraphQL API.

**Key responsibilities**:
- Constructs URLs from base + path (`/cms/manage` or `/graphql`)
- Adds auth headers (`Authorization: Bearer`, `x-tenant`, `Content-Type: application/json`)
- Retry logic via `p-retry` (5 retries for both queries and mutations)
- Batched mutations via `lodash/chunk` with configurable `atOnce` concurrency

**Methods**:
- `query<T>(params)` — single GraphQL query with retry
- `mutation<T>(params)` — single GraphQL mutation with retry
- `mutations<T>(params)` — batched mutations: chunks variables, executes each chunk in parallel
- `setTenant(tenant)` — updates the `x-tenant` header mid-run

**Response parsing**: Delegates to a caller-provided `getResult(json)` function that extracts the correct shape from the raw GraphQL response.

### 4b. GroupApplication (`src/apps/GroupApplication.ts`)

Creates CMS content model groups (Blog, Cars).

**Flow**:
1. Lists existing groups via `listContentModelGroups` query
2. Skips any that already exist (by slug match)
3. Creates missing ones via `createContentModelGroup` mutation
4. Stores results in `this.groups[]` for downstream use by `ModelApplication`

### 4c. ModelApplication (`src/apps/ModelApplication.ts`)

Creates CMS content models.

**Flow**:
1. Gets group slugs from `GroupApplication`
2. Builds model definitions (blog: Category, Author, Article; cars: SimpleCarMake, SimpleCarModel)
3. Lists existing models, skips duplicates
4. Creates via `createContentModel` mutation
5. Exposes `getModel(id)` and `fetch(modelId)` for runtime model retrieval

**Notable**: Defines a detailed GraphQL subselection (`cmsModelFieldsGraphQlSubselection`) for fetching field metadata including validation, predefined values, and list validation.

### 4d. EntryApplication (`src/apps/EntryApplication.ts`)

Orchestrates entry creation through the **runner pattern**.

**Runners**: Each runner is a factory function that returns `{ id, name, exec() }`:
- `blogRunnerFactory` — creates categories → authors → articles (with ref links)
- `simpleCarsRunnerFactory` — creates car makes → car models (with ref links)

**Key method**: `createViaGraphQL<T>(params)` — generates a GraphQL mutation from model metadata, sends variables in batches, collects results and errors.

**GraphQL mutation generation** (`createGraphQLMutation`): Dynamically constructs the mutation string using `createModelFields()` which maps field types to their GraphQL selection syntax.

### 4e. FetchEntriesApplication (`src/apps/FetchEntriesApplication.ts`)

Paginated entry fetcher that can export to JSON.

**CLI args**:
- `--model` (required) — model ID to fetch
- `--max-requests` (default: 100) — max pages to fetch
- `--per-request` (default: 1000) — entries per page
- `--filename` — if set, writes results to JSON file

**Flow**: Fetches model metadata → paginates through entries using cursor → optionally writes to file via `writeJsonFileSync`.

### 4f. FolderApplication (`src/apps/FolderApplication.ts`)

Creates ACO (Advanced Content Organization) folders. Currently **commented out** in the main Application routing.

Uses the same runner pattern as EntryApplication. Folder runner creates hierarchical folders (parent → children) for Page, CMS, and File Manager types.

### 4g. TenantsApplication (`src/apps/tenants/TenantsApplication.ts`)

Creates tenants via `installNamedTenant` mutation.

**CLI args**: `--tenants` (comma-separated tenant names)

**listTenants()**: Currently hardcoded to return `[{ id: "root", name: "Root" }]`. The real GraphQL query is commented out.

### 4h. EntryPerTenantApplication (`src/apps/tenants/EntryPerTenantApplication.ts`)

Bulk creates entries across multiple tenants and models. The most complex application.

**CLI args**:
- `--tenants` — comma-separated, or `*` for all
- `--models` — comma-separated, or `*` for all
- `--amount` — entries per model per tenant (default: 5)
- `--startFromTenant` — resume from a specific tenant
- `--dryRun` / `--dryRunPath` — generate data without sending to API
- `--cache` — enable/disable caching (default: true)

**Flow**:
1. Lists tenants (from cache or API)
2. For each tenant: sets tenant header → lists models (cached) → filters by input
3. For each model: generates fake entry variables via `createEntryVariables()` → sends to API
4. Supports dry-run mode that writes generated data to a timestamped JSON file

---

## 5. Field Generator System (`src/apps/tenants/helpers/generators/`)

A **registry-based plugin system** for generating fake field values based on CMS model field metadata.

### Architecture

```
getGenerator({ field }) → registry.getGenerator() → IRegistryGenerator → .generate(field)
```

**Registry** (`registry.ts`): Singleton that stores generators and validators. Key behaviors:
- Generators are matched by `field.type` (split on `:` for composite types like `dynamicZone`) and `field.list` (single vs. multi)
- Validators are cached per field+validator combination using `MemoryCache`
- Uses constructor-based dependency injection: generators receive `{ getGenerator, getGeneratorByField }` for recursive/nested generation

### Base Classes (`BaseGenerator.ts`)

- `BaseGenerator<T>` — abstract single-value generator. Has `type`, `list=false`, abstract `generate()`
- `BaseMultiGenerator<T>` — abstract multi-value generator. Has `list=true`, provides `iterate(amount, callback)` helper with configurable min/max via faker

### Field Generators (11 types)

| Generator | Type | Generates | Notable |
|---|---|---|---|
| `TextGenerator` | `text` (single) | faker words, respects predefined values, pattern presets (email/url/case) | Uses MinLength, MaxLength, Pattern validators |
| `MultiTextGenerator` | `text` (list) | Array of text values | |
| `NumberGenerator` | `number` (single) | Random int 1-100, respects predefined values | |
| `MultiNumberGenerator` | `number` (list) | Array of numbers | |
| `BooleanGenerator` | `boolean` | Random true/false | |
| `DateTimeGenerator` | `datetime` (single) | Delegates to date/ helpers based on `field.settings.type` | Supports: time, date, dateTimeWithoutTimezone, dateTimeWithTimezone |
| `MultiDateTimeGenerator` | `datetime` (list) | Array of datetime values | |
| `LongTextGenerator` | `long-text` (single) | faker lorem words with length bounds | |
| `JsonGenerator` | `json` (single) | Structured object with name/description/data/value/dates | |
| `FileGenerator` | `file` (single) | Random HTTPS URL | |
| `RichTextGenerator` | `rich-text` (single) | Structured tag-based document (h1 + paragraphs) | |
| `RefGenerator` | `ref` (single/list) | **Returns null** — refs cannot be auto-generated | |
| `ObjectGenerator` | `object` (single/list) | **Recursive**: iterates `field.settings.fields`, calls `getGeneratorByField` for each | |
| `DynamicZoneGenerator` | `dynamicZone` (single/list) | Picks random template, generates all template fields recursively | |

### Date Helpers (`fields/date/`)

Four specialized formatters that respect `gte`/`lte` validation constraints:
- `createDate` → `YYYY-MM-DD`
- `createTime` → `HH:MM:SS`
- `createDateTimeWithoutTimezone` → ISO 8601
- `createDateTimeWithTimezone` → `YYYY-MM-DDThh:mm:ss±hh:mm`

### Validator System (`validators/`)

Validators read CMS field validation rules and extract constraint values.

**Base**: `BaseValidator<T>` — uses zod to validate the validation schema itself. Provides `getValidation(name)` and `getListValidation(name)` for field-level and list-level validation.

| Validator | Reads Rule | Returns |
|---|---|---|
| `MinimumLengthValidator` | `minLength` | `number` (from `settings.value`) |
| `MaximumLengthValidator` | `maxLength` | `number` |
| `PatternValidator` | `pattern` | `PatternValidationSettings` (preset, regex, flags) |
| `GreaterThanOrEqualDateValidator` | `dateGte` | `string` (date value) |
| `LesserThanOrEqualDateValidator` | `dateLte` | `string` (date value) |

---

## 6. Utility Fields System (`src/apps/utils/fields/`)

Generates **GraphQL field selection strings** for dynamic query/mutation construction.

### Pattern

`createField({ type, definition })` returns a factory function. Each field type has a simple implementation:
- Most just return `field.fieldId` (the GraphQL field name)
- `ref.ts` returns `${field.fieldId} {id entryId modelId}` (includes subselection for reference fields)

`createAllowedFields()` builds a `Record<string, ICreateFieldDefinition>` mapping field types to their GraphQL selection generators.

`createModelFields(fields)` maps all model fields through this lookup and joins them with newlines, producing a complete GraphQL values selection.

**Note**: There's a naming swap — `longText.ts` exports `createRichTextField` and `richText.ts` exports `createLongTextField`.

---

## 7. Cache System (`src/cache/`)

### Interface: `ICache`
```typescript
interface ICache {
  disable(): void;
  enable(): void;
  get<T>(cacheKey: ICacheKey): T | null;
  set<T>(cacheKey: ICacheKey, value: T): T;
  getOrSet<T>(cacheKey: ICacheKeyInput, cb: () => Promise<T>): Promise<T>;
  clear(cacheKey?: ICacheKey | ICacheKey[]): void;
}
```

### CacheKey (`CacheKey.ts`)

Creates a SHA-256 hex hash from input. Inputs can be strings, numbers, objects, arrays, or other CacheKeys (recursive composition).

### FileCache (`FileCache.ts`)

- Stores data as JSON files in a configurable directory (default: `./.cache/`)
- TTL-based expiry (default: 300 seconds)
- On construction, clears any expired files
- Can be disabled/enabled at runtime (used by `EntryPerTenantApplication` to control caching)
- Tracks all written keys for bulk clear

### MemoryCache (`MemoryCache.ts`)

- Simple `Map<string, unknown>` storage
- Used by the generator registry to cache validator instances per field
- Same `ICache` interface but in-memory only

---

## 8. GraphQL Interaction Pattern

### Two API Paths
- `/cms/manage` — CMS content management (groups, models, entries)
- `/graphql` — General Webiny API (tenants, ACO folders)

### Common Pattern
1. Application defines a GraphQL query/mutation string (inline template literals)
2. Provides a `getResult(json)` callback that extracts the expected data shape from the raw response
3. Calls `graphql.query()` or `graphql.mutation()` with path, variables, and getResult
4. Result is `{ data, error, extensions }` — callers check for `error` before proceeding

### Generic Result Parser (`createGetCmsContentResult.ts`)
Most CMS operations use this factory: it reads `json.data.data.data` (three levels deep: API response → GraphQL operation → Webiny envelope → actual data). Accepts an optional transform callback.

### Batch Mutations
`graphql.mutations()` chunks a variable array by `atOnce`, runs each chunk's mutations in parallel via `Promise.all`, and collects all results sequentially.

---

## 9. CLI Entry Point (`src/index.ts`)

Minimal entry:
```typescript
const argv = await yargs(hideBin(process.argv)).version(false).argv;
const app = new Application(argv as unknown as ApplicationParams);
await app.run();
```

No formal command definitions — all args are parsed as boolean/string/number by the Application itself.

### Available CLI Arguments

| Argument | Type | Default | Used By |
|---|---|---|---|
| `--create-data` | boolean | false | Application routing |
| `--fetch-data` | boolean | false | Application routing |
| `--create-tenants` | boolean | false | Application routing |
| `--create-data-per-tenant` | boolean | false | Application routing |
| `--tenant` | string | "root" | Application → GraphQLApplication |
| `--skip` | string | "" | EntryApplication, FolderApplication (comma-separated runner IDs) |
| `--articles:startId` | number | 1 | Blog runner |
| `--articles:amount` | number | 100 | Blog runner |
| `--articles:atOnce` | number | 10 | Blog runner |
| `--simpleCarModels:atOnce` | number | 10 | Simple cars runner |
| `--model` | string | "" | FetchEntriesApplication |
| `--max-requests` | number | 100 | FetchEntriesApplication |
| `--per-request` | number | 1000 | FetchEntriesApplication |
| `--filename` | string | "" | FetchEntriesApplication |
| `--tenants` | string | "" | TenantsApplication, EntryPerTenantApplication |
| `--models` | string | "" | EntryPerTenantApplication |
| `--amount` | number | 5 | EntryPerTenantApplication |
| `--startFromTenant` | string | "" | EntryPerTenantApplication |
| `--dryRun` | boolean | false | EntryPerTenantApplication |
| `--dryRunPath` | string | "./dryRuns" | EntryPerTenantApplication |
| `--cache` | boolean | true | EntryPerTenantApplication |
| `--cacheDir` | string | "./.cache/" | Application (FileCache) |

---

## 10. Type System (`src/types.ts`)

Central type definitions. Key patterns:

- **Webiny types re-exported**: `ApiCmsGroup`, `ApiCmsModel`, `ApiCmsModelField` are `Pick<>` subsets of `@webiny/api-headless-cms` types
- **GraphQL result types**: `ApiGraphQLResult<T>` is a discriminated union of success/error
- **Application interfaces**: `IBaseApplication`, `IGroupApplication`, `IModelApplication`, `IEntryApplication`, `IFolderApplication`, `IFetchEntriesApplication`
- **Runner pattern types**: `IEntryRunner<T>`, `IEntryRunnerFactory<T>`, `IFolderRunner`, `IFolderRunnerFactory`
- **CMS domain types**: `CmsEntry<T>`, specific entry types (ApiCmsCategory, ApiCmsAuthor, etc.)
- **GenericRecord**: Utility type `Record<string | number | symbol, any>` used extensively

---

## 11. Error Handling

### GraphQLError (`src/errors/GraphQLError.ts`)
```typescript
class GraphQLError extends Error {
  public readonly code: number;     // HTTP status code
  public readonly data?: GenericRecord | string | undefined | null;
}
```
Thrown by `GraphQLApplication.parse()` when HTTP status is not 200.

### NotFoundError (`src/errors/NotFoundError.ts`)
Simple `extends Error`, used by `EntryPerTenantApplication` when no tenants found.

### General Error Handling
- `p-retry` handles transient network failures (5 retries)
- Most applications check for `result.error` and log via pino, but don't throw (fail-soft for batch operations)
- Top-level `main().catch()` in `src/index.ts` catches unhandled errors

---

## 12. Logger (`src/logger.ts`)

```typescript
const logger = pino({ level: "trace" }, pinoPretty({ ignore: "pid,hostname" }));
```

Singleton pino logger at trace level with pretty formatting. Used throughout all applications for debug/info/warn/error logging.

---

## 13. Data Flow Summary

### `--create-data` flow
```
Application.run()
  → GroupApplication.run()
      → List existing groups → Create missing (Blog, Cars)
  → ModelApplication.run()
      → List existing models → Create missing (Category, Author, Article, SimpleCarMake, SimpleCarModel)
  → EntryApplication.run()
      → blogRunner.exec()
          → Create categories (10 hardcoded)
          → Create authors (7 hardcoded)
          → Create articles (N, randomized with refs to above)
      → simpleCarsRunner.exec()
          → Create car makes (~35 brands from carsList)
          → Create car models (~1000+ models with refs to makes)
```

### `--create-data-per-tenant` flow
```
Application.run()
  → EntryPerTenantApplication.run()
      → List tenants (cached)
      → For each tenant:
          → Set x-tenant header
          → List models (cached, filtered)
          → For each model:
              → createEntryVariables(model, amount)
                  → For each field in model:
                      → registry.getGenerator({ field })
                          → generator.generate({ field, getValidator })
                              → faker.* generates value
                              → Validators constrain (min/max/pattern/date range)
              → EntryApplication.createViaGraphQL(model, variables)
```

---

## 14. Key Observations for Refactoring

1. **Tight .env coupling**: The `getEnv()` function in `Application.ts` directly reads `process.env`. No abstraction for project configuration — single project per .env file.

2. **No dependency injection**: Sub-applications are manually instantiated in `Application` constructor. The `getApp()` method is a string-keyed service locator.

3. **Command routing is primitive**: Boolean flag if/else chain instead of proper command definitions. No help text, no validation.

4. **Hardcoded model definitions**: Blog and Cars models are defined inline in TypeScript. No way to add models without code changes.

5. **Generator registry is global**: `registry.ts` exports a singleton. All generators self-register via side-effect imports. Not testable or configurable per-project.

6. **Cache serves dual purposes**: Used for both operational caching (avoiding repeated API calls) and potentially for persistence (tenant/model lookups). No database or structured storage.

7. **FolderApplication and page features are commented out**: Several features were started but disabled.

8. **TenantsApplication.listTenants() is stubbed**: Returns hardcoded data instead of querying the API.

9. **Naming inconsistencies**: `longText.ts` exports `createRichTextField`, `richText.ts` exports `createLongTextField` — the names are swapped.

10. **Strong generator/validator system**: The `generators/` hierarchy is well-designed for the refactoring — it already supports recursive field types (objects, dynamic zones) and validation-aware generation. This should be preserved and enhanced.
