# Domain

## Core Concepts

### Project
A Webiny CMS instance connection. Has a name, API URL, auth token, and default tenant. Stored in SQLite.

### Model
A CMS content model from a connected Webiny project. Has fields with types (text, number, boolean, datetime, file, rich-text, ref, object, dynamicZone). Fetched dynamically from the Webiny API.

### Entry
A single CMS content entry conforming to a model's field definitions. Generated using faker-based field generators that respect validation rules.

### Seed Job
A request to generate and send entries to a Webiny project. Configured with: which models, how many entries per model. Tracked with status (pending → running → completed/failed), timestamps, and results.

### Generator
A per-field-type strategy for generating realistic fake data. Generators respect CMS validation rules (min/max length, pattern, date range) and support recursive types (objects, dynamic zones).

### Validator
A per-rule constraint reader that extracts validation parameters from CMS field metadata (minLength, maxLength, pattern, dateGte, dateLte) so generators produce valid data.

## Bounded Contexts

| Context | Responsibility | Layer |
|---|---|---|
| Project Management | CRUD for project connections | CLI + API + UI |
| Model Discovery | Fetch and display available models from Webiny | API + UI |
| Data Generation | Generate fake entries from model metadata + field generators | Shared (generators/) |
| Data Seeding | Send generated entries to Webiny CMS via GraphQL | CLI + API |
| Seed History | Track and display seeding job results | API + UI |
