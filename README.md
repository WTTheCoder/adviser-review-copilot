# Client Review Prep Agent

Client Review Prep Agent is a prototype for financial advisers preparing annual client reviews. The long-term direction is to prepare source-backed review material from fragmented legacy CRM records, review documents, and meeting notes.

This repository is not a production financial-advice system and does not contain real customer data, proprietary branding, or hardcoded model-provider secrets.

## Current Milestone

Phase 6B1 adds controlled text-based PDF ingestion alongside the existing `.txt` and `.md` adviser-note flow. Review preparation, document ingestion, and adviser decisions route through a typed execution harness with registered skills, registered tools, allowlists, Zod validation, safe failure responses, and visible execution metadata.

Mock extraction is the safe default and works offline. Optional live OpenAI extraction uses the official OpenAI SDK and Responses API when `AI_MODE=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` are configured.

Phase 5 extraction candidates now drive the adviser-facing candidate projection for address and risk profile while official facts remain backend-controlled. Empty extraction clears the current candidate projection for those fields rather than showing stale seeded candidates. Numeric extraction remains advisory until deterministic normalization is expanded.

Risk-profile candidates are normalized by application-owned domain logic before projection. The Phase 5 canonical set is `Conservative`, `Balanced`, `Growth-oriented`, and `High Growth`; unsupported or ambiguous model phrases are omitted rather than stored as arbitrary risk-profile values.

The `Items needing confirmation` summary metric is a combined unresolved-review count for facts in `NEEDS_CONFIRMATION` or `REQUIRES_ADVISER_APPROVAL`. `Meaningful changes` combines the fictional verified historical changes with currently visible candidate changes from the latest preparation projection.

Dynamic skills, authentication, OCR, scanned/image-only PDFs, DOCX parsing, malware scanning services, cloud object storage, and real financial recommendations are still deferred.

## Architecture

```text
React adviser workspace
-> Node.js review API
-> controlled execution harness
-> registered skills
-> allowlisted tools
-> document-type validation and bounded PDF text extraction
-> normalized SourceRecord text persistence
-> controlled candidate-fact extractor
-> review service
-> controlled legacy CRM adapter
-> PostgreSQL
```

The legacy CRM adapter is a deliberate backend boundary. It simulates an existing legacy CRM that controlled skills operate through. The adviser-facing application does not require users to navigate that legacy system directly.

Phase 4 skills are deterministic TypeScript modules, not model prompts. The harness validates skill inputs, enforces tool allowlists, validates tool and skill outputs, records execution events, and returns safe error messages.

Phase 5 model output is advisory. The model returns schema-constrained candidate facts only; deterministic application rules decide what remains pending confirmation, requires adviser approval, or stays advisory.

## Repository Structure

- `apps/web`: React, TypeScript, Vite, and Tailwind CSS frontend.
- `apps/api`: Node.js, TypeScript, Fastify API, controlled execution harness, deterministic skills/tools, Prisma schema, migrations, and seed script.
- `apps/api/src/ai`: Candidate-fact extraction contracts, schemas, prompt builder, mock provider, OpenAI provider adapter, and small eval fixtures.
- `packages/shared`: Shared TypeScript types and Zod schemas for API contracts.
- `docs/architecture`: Architecture notes for the controlled skills and harness boundary.
- `.github/workflows/ci.yml`: CI for lint, type checking, tests, and builds.
- `docker-compose.yml`: Local PostgreSQL service for the demo.

## Installation

```bash
npm install
```

Copy `.env.example` to `.env` if you want local environment variables available in your shell. `.env` remains ignored by Git.

AI configuration:

- `AI_MODE=mock`: offline deterministic extraction, safe default.
- `AI_MODE=openai`: uses the official OpenAI SDK and Responses API.
- `OPENAI_API_KEY`: required only for live OpenAI mode.
- `OPENAI_MODEL`: required only for live OpenAI mode.
- `OPENAI_TIMEOUT_MS=15000`: live request timeout.

## Database

Start PostgreSQL:

```bash
npm run db:up
```

Run migrations:

```bash
npm run db:migrate
```

Seed the fictional Alex Taylor demo:

```bash
npm run db:seed
```

Reset the local database and reseed:

```bash
npm run db:reset
```

Stop PostgreSQL:

```bash
npm run db:down
```

Local demo database defaults:

- Database: `client_review_prep`
- User: `client_review`
- Password: `local_demo_password`
- Port: `5432`

These are local-demo credentials only.

## Development Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run dev` starts both the frontend and backend. The API expects `DATABASE_URL` to point at the local PostgreSQL database.

GitHub Actions runs lint, type checking, tests, and production builds for pushes and pull requests targeting `main`. CI does not start PostgreSQL yet; database-dependent CI can be added in a later focused change.

## Local URLs

- Web app: `http://localhost:5173`
- API health: `http://localhost:3001/health`
- Demo review: `http://localhost:3001/api/clients/demo-alex-taylor/review`

## API Endpoints

- `GET /health`: API health check.
- `GET /api/clients/:clientId/review`: Returns client summary, source records, facts, meaningful changes, adviser actions, and latest workflow trace.
- `POST /api/clients/:clientId/prepare-review`: Creates or refreshes a deterministic workflow run and returns prepared review data.
- `POST /api/clients/:clientId/source-records/upload`: Validates one local `.txt`, `.md`, or text-based `.pdf` source document and stores normalized text as an adviser meeting-note source record.
- `POST /api/clients/:clientId/facts/:factId/decision`: Persists one adviser decision and lets backend domain logic update fact state.
- `POST /api/demo/reset`: Local demonstration reset for the fictional Alex Taylor data.

The reset endpoint is for local demonstration only. It reseeds the fictional Alex Taylor data and removes uploaded demo source records. Upload persistence and reset share a per-client generation and serialized commit boundary, so an upload that began before reset cannot write afterward. This in-memory coordination is suitable only for the single-process local prototype; multiple API instances would require database-backed or distributed coordination.

## Document Uploads

Phase 6B1 supports one local `.txt`, `.md`, or `.pdf` upload at a time for the fictional Alex Taylor client.

- TXT/Markdown: UTF-8 text, 256 KB by server-calculated UTF-8 byte length, and 256K decoded characters.
- PDF: `application/pdf`, 2 MB original bytes, 25 pages, 250,000 extracted characters, and 512 KB extracted UTF-8 text.
- PDF support is limited to embedded selectable text. OCR, scanned/image-only PDFs, encrypted PDFs, password-protected PDFs, embedded attachments, form-field extraction, and an embedded PDF viewer are not supported.

The upload API keeps the existing application-owned JSON protocol. Text is sent as validated JSON text; PDF bytes are sent as bounded base64 inside a discriminated JSON request. Fastify applies a 2,812,588-byte route body limit and rejects oversized JSON before schema validation, base64 decoding, parsing, or persistence. This adds base64 size overhead compared with multipart streaming, but preserves the fixed route, one-file limit, in-memory processing, and no-filesystem boundary for this small local prototype. Multipart streaming can be reconsidered for a production ingestion service.

PDF parsing uses `unpdf` 1.6.2 under the MIT license. It accepts in-memory bytes and ships a serverless PDF.js build with its worker bundled, so no worker configuration is required in the Node.js API. The application wrapper disables PDF.js string evaluation, does not render pages or images, does not fetch URLs, and exposes only normalized text, page count, safe counts, and application-owned warnings/errors. Encryption/password handling is derived from parser errors rather than raw `/Encrypt` substring scanning. Tests cover the demonstrated PDF.js `PasswordException` shape; no encrypted fixture is committed, so parser failures that cannot be classified accurately fall back to `PDF_PARSE_FAILED` rather than guessing. A centralized 15-second timeout bounds how long the API awaits parsing and returns a safe application error; it does not terminate parser CPU or memory use if the underlying library continues running. Its other limitation is that PDF text order depends on the document's embedded text structure; complex layouts may not read like a visually rendered page.

Uploaded filenames are treated as untrusted display metadata: path components are stripped, traversal and control characters are rejected, length is limited, and filenames are never used as server filesystem paths. Uploaded Markdown and extracted PDF text are displayed as plain text, not rendered as HTML.

For this local prototype, validated TXT/Markdown text or normalized extracted PDF text and safe metadata are stored in PostgreSQL on the existing `SourceRecord` row. Raw PDF bytes are not retained. A production system would normally require secure object storage, retention and deletion policy, malware scanning, access controls, and audit controls before accepting real client documents.

Uploaded source text is untrusted data. It can be used as evidence for candidate extraction, but it cannot choose tools, execute instructions, approve facts, write to a production CRM, read server files, or access secrets.

Source-record selection for preparation is ordered by newest observed date, uploaded records first when dates tie, then stable source-record ID. TXT, Markdown, and PDF uploads are treated equally when observed dates are equal.

## Controlled Skills and Tools

Registered skills:

- `load-client-context`: Loads a client, source records, and known facts through legacy CRM tools.
- `reconcile-client-facts`: Reconciles loaded facts into adviser-review items.
- `prepare-annual-review`: Coordinates review preparation, workflow trace persistence, and review response generation.
- `ingest-client-document`: Validates one local text or PDF upload, extracts bounded PDF text when needed, and persists normalized source text.
- `apply-adviser-decision`: Applies one adviser decision through deterministic backend domain rules.

Registered tools:

- `legacy.getClient`
- `legacy.getSourceRecords`
- `legacy.getFacts`
- `document.validateTextUpload`
- `document.validatePdfUpload`
- `document.extractPdfText`
- `ai.extractCandidateFacts`
- `review.createWorkflowRun`
- `review.recordWorkflowStep`
- `review.createUploadedSourceRecord`
- `review.getPreparedReview`
- `review.applyDecision`

The frontend displays the selected or executed skill and extraction mode in the review workspace and keeps the existing execution trace visible. Re-running preparation is supported; repeated runs create a new workflow run without duplicating seeded facts or source records.

Extraction limits:

- Meeting-note text sent to the extractor is capped at 4,000 characters.
- At most 10 candidate facts are accepted.
- Evidence text is capped at 240 characters.
- Proposed values are capped at 160 characters.

Only the fictional adviser meeting-note text, safe client display name, source metadata, and narrow supported-field list are sent to OpenAI in live mode. API keys, audit history, database rows, chain of thought, raw provider payloads, and unrelated customer data are not sent or stored by this prototype.

## Demonstration Workflow

The seeded demo uses one fictional client, Alex Taylor, advised by Jordan Lee for the 2026 Annual Review. It loads three source records: a 2023 legacy CRM record, a 2025 annual review, and a 2026 adviser meeting note. You can add one `.txt`, `.md`, or text-based `.pdf` note from the upload panel, then run Prepare/Re-run to extract candidate address and risk-profile changes from the uploaded source in mock mode.

The workflow persists preparation results, adviser decisions, and audit trace records in PostgreSQL. Refreshing the browser after preparation or after adviser decisions keeps the persisted state visible.

## Later Milestones

Model-selected skills are intentionally not included in this milestone. Phase 6B2 defers OCR and scanned/image-only PDF handling. Complex or malicious PDFs remain a reason to move parsing into isolated asynchronous workers with process and memory limits. Other later work includes DOCX and image ingestion, multiple-file batch upload, multipart/streaming transport review, cloud object storage, malware scanning services, authentication, production CRM writes, distributed reset/upload coordination, and deployment hardening.
