# ADR-018: File Uploads for Content Entries

**Date:** 2026-09-03
**Status:** Future

## Context

Webiny CMS entries can have `file` type fields that reference uploaded files (images, documents, etc.). Currently the FileGenerator produces fake URLs, but real seeding needs actual files uploaded to Webiny's file manager.

## Requirements

- Upload files to Webiny's file manager via API
- Attach uploaded file references to entry `file` fields during seeding
- Support bulk uploads (many entries × many file fields)
- Support different file types: images, PDFs, documents
- Users can provide a directory of files to use, or use placeholder/generated files

## Planned Approach

### File Sources
1. **Local directory** — user provides a folder of files to upload
2. **Placeholder images** — generate via placeholder services or local canvas
3. **Sample files** — bundled sample PDFs, images for testing

### Upload Flow
```
File source → Upload to Webiny File Manager → Get file ID/URL → 
Store in local DB → FileGenerator picks from uploaded file pool
```

### Schema Addition
```
project_files
├── id            TEXT PK
├── project_id    TEXT FK → projects.id ON DELETE CASCADE
├── tenant        TEXT NOT NULL
├── file_key      TEXT NOT NULL (Webiny file key/ID)
├── file_url      TEXT NOT NULL
├── file_name     TEXT NOT NULL
├── file_type     TEXT NOT NULL (image/jpeg, application/pdf, etc.)
├── file_size     INTEGER
├── uploaded_at   INTEGER NOT NULL
└── UNIQUE(project_id, file_key)
```

### Services
- **FileUploadService** — uploads files to Webiny via the File Manager GraphQL API
- **FilePoolRepository** — stores and retrieves uploaded file references
- **Updated FileGenerator** — picks from the uploaded file pool instead of generating fake URLs

### CLI Integration
```
yarn cli upload-files   — select project → select directory → upload files
yarn cli seed           — file fields automatically use uploaded file pool
```

### UI Integration
- File upload section in project detail page
- Drag-and-drop or file picker
- Shows uploaded file pool with previews
- Seed config shows which file pool to use

### Webiny File Manager API
The File Manager uses a presigned URL upload flow:
1. `createFile` mutation → gets presigned S3 URL
2. Upload file to S3 via presigned URL
3. `createFilesViaUrl` or similar mutation to register in Webiny

This needs to be version-aware (different Webiny versions may have different upload APIs).
