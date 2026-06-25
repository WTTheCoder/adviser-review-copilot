# Client Review Prep Agent

An AI-assisted annual-review preparation agent for financial advisers that combines legacy CRM data with uploaded client documents while keeping high-impact decisions under adviser control.

## The Problem

Annual-review information is often fragmented across legacy CRM records, prior reviews, meeting notes, and client documents. Advisers spend valuable time finding changes, checking sources, and assembling a coherent current picture.

Letting an AI model overwrite financial records directly would be unsafe. This project instead treats model output as a proposal: every candidate is source-backed, reviewable, and subject to deterministic domain rules. Uncertain address changes require confirmation, while risk-profile changes require explicit adviser approval.

## What The Application Does

- Loads a fictional client's baseline from a legacy CRM adapter.
- Accepts UTF-8 TXT, Markdown, and text-based PDF documents.
- Extracts source-backed candidate facts in deterministic mock mode or optional OpenAI mode.
- Reconciles official, previous, and candidate values without silently replacing official facts.
- Identifies meaningful changes and unresolved review items.
- Routes address candidates for confirmation and risk-profile candidates for approval.
- Preserves evidence, source attribution, workflow traces, and adviser decisions.
- Supports deterministic reset and replay of the Alex Taylor demo.

## Demo Workflow

1. Reset the fictional Alex Taylor case.
2. Show the CRM baseline: address `East Perth` and risk profile `Balanced`.
3. Upload a source from [`demo/`](demo/).
4. Prepare the annual review.
5. Inspect the possible new address and possible new risk profile.
6. Open Evidence and the execution trace to show where each proposal came from.
7. Confirm the address and approve the risk-profile change.
8. Refresh the page.
9. Verify the approved values remain current and the former values remain visible as history.

See [`demo/DEMO_SCRIPT.md`](demo/DEMO_SCRIPT.md) for a reliable 3-5 minute walkthrough.

## Architecture

```mermaid
flowchart LR
  UI[React Web UI] --> API[Fastify API]
  API --> Skill[Review preparation skill]
  Skill --> Tools[Allowlisted tools]
  Tools --> Legacy[Legacy CRM adapter]
  Tools --> Ingest[Document ingestion]
  Tools --> AI[Candidate extraction]
  Legacy --> Domain[Domain reconciliation and decision rules]
  Ingest --> Domain
  AI --> Domain
  Domain --> DB[Prisma / PostgreSQL]
```

Skills orchestrate bounded workflows. Tools perform allowlisted operations. AI proposes candidate facts; backend domain rules determine lifecycle state and promotion. Advisers retain control of high-impact updates.

The API is separated into routes, an execution harness, registered skills and tools, AI provider adapters, domain rules, services, and Prisma persistence. The frontend consumes validated shared contracts and does not own financial promotion rules.

## Technology Stack

- React, TypeScript, Vite, and Tailwind CSS
- Node.js and Fastify
- PostgreSQL and Prisma
- Zod shared contracts
- Vitest
- Docker Compose
- GitHub Actions
- OpenAI Responses API integration with deterministic mock mode
- `unpdf` / PDF.js-based text extraction

## Supported Documents And Limits

Application-owned constants in [`packages/shared/src/index.ts`](packages/shared/src/index.ts) define the enforced limits:

| Input | Current limit |
| --- | --- |
| TXT / Markdown | UTF-8, 256 KiB and 262,144 decoded characters |
| PDF original bytes | 2 MiB |
| PDF pages | 25 |
| PDF extracted text | 250,000 characters and 512 KiB UTF-8 |
| Filename | 120 sanitized characters |
| Extractor input | 4,000 characters |
| Candidate facts | 10 |
| Evidence / proposed value | 240 / 160 characters |

PDF support is limited to documents with embedded selectable text. OCR, scanned/image-only PDFs, encrypted or password-protected PDFs, form extraction, and embedded-file processing are not supported. Raw PDF bytes are processed in memory and are not retained; only normalized extracted text and safe metadata are stored.

## Safety Model

- Candidate facts are never treated as official facts automatically.
- AI cannot directly mutate official client records.
- Evidence is linked to the source record used for extraction.
- Address confirmation and risk-profile approval are deterministic backend decisions.
- Unsupported, negated, retained-current, rejected, and contradictory risk language does not create an aggressive candidate.
- Skills may call only their allowlisted tools.
- Provider and parser errors are mapped to application-owned safe errors.
- Request, decoded-byte, page, extracted-character, extracted-byte, and parser wait-time limits are enforced.
- PDF parsing has a 15-second application timeout, but it is not process-isolated; a timed-out parser may continue consuming local process resources until the library call finishes.
- Uploaded text is untrusted content and is displayed as plain text.

This is portfolio/demo software, not production financial advice software.

## Local Setup

### Prerequisites

- Node.js `22.13.0` (the CI version)
- npm
- Docker Desktop with Docker Compose
- PowerShell

### First Start On Windows

```powershell
npm install

$env:POSTGRES_PORT = "55432"
$env:DATABASE_URL = "postgresql://client_review:local_demo_password@localhost:55432/client_review_prep?schema=public"
$env:AI_MODE = "mock"

npm run db:up
npm run prisma:generate -w apps/api
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:5173`. The API health endpoint is `http://localhost:3001/health`.

The `55432` host port avoids a common conflict with an existing PostgreSQL installation. Keep `POSTGRES_PORT` and the port in `DATABASE_URL` aligned.

### Subsequent Starts

```powershell
$env:POSTGRES_PORT = "55432"
$env:DATABASE_URL = "postgresql://client_review:local_demo_password@localhost:55432/client_review_prep?schema=public"
$env:AI_MODE = "mock"
npm run db:up
npm run dev
```

Stop the database with `npm run db:down`.

Optional live extraction requires `AI_MODE=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL`. Mock mode is the safe, deterministic default and is sufficient for the complete demo.

## Testing

Run the same quality checks used for release verification:

```powershell
npm run prisma:generate -w apps/api
npm run lint
npm run typecheck
npm test
npm run build
docker compose config
git diff --check
```

Final verified suite: **279 tests** across the API, web, and shared workspaces.

GitHub Actions runs Prisma generation, lint, type checking, tests, and production builds on pushes and pull requests targeting `main`.

## Repository Structure

```text
.
|-- apps/
|   |-- api/              Fastify API, skills, tools, domain rules, Prisma
|   `-- web/              React adviser workspace
|-- packages/
|   `-- shared/           Shared Zod schemas, types, and ingestion limits
|-- demo/                 Fictional sample documents and demo script
|-- docs/architecture/    Model boundary and execution-harness notes
|-- .github/workflows/    Continuous integration
|-- docker-compose.yml    Local PostgreSQL
`-- package.json          npm-workspaces commands
```

## Current Scope And Limitations

This repository demonstrates a controlled financial-agent workflow with fictional data. It is not a production CRM integration, a system of record, or financial advice.

Production follow-up work includes:

- authentication and authorization;
- multi-tenancy and tenant isolation;
- real CRM integrations;
- OCR for scanned documents;
- worker/process isolation for document parsing;
- object storage, retention controls, and malware scanning;
- distributed upload/reset coordination across API instances;
- production observability and incident response;
- privacy, regulatory, and compliance review;
- production model evaluation and monitoring.

Automated backend and domain coverage is strong. Frontend upload lock/abort/reset behavior is covered mainly through focused state/controller tests rather than full browser interaction tests. Runtime composition is explicit and inspected in tests, but a larger multi-request integration suite remains a production follow-up. The in-memory client operation coordinator is intentionally single-process.

## Design Principles

- AI proposes; domain rules decide.
- Evidence before mutation.
- Human approval for high-impact facts.
- Deterministic fallback.
- Bounded ingestion.
- Auditable execution.
