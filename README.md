# Adviser Review Copilot

Adviser Review Copilot is a portfolio-quality demo for preparing source-backed client reviews from fragmented financial-advice records. It combines simulated legacy CRM data, previous review records, meeting notes, and uploaded client documents, then presents advisers with the changes that matter and the decisions that still need human judgement.

This is not a deployed production financial system, a production CRM integration, or financial, tax, or investment advice.

## Problem

Financial advisers often prepare client reviews from information spread across legacy CRM records, previous review files, adviser meeting notes, and client-supplied documents. Simple extraction or structuring still leaves a large pile of data and no clear answer to:

- what changed;
- what matters;
- what needs confirmation;
- what requires approval;
- which source supports each conclusion.

Letting an AI model overwrite client facts directly would be unsafe. The core design principle here is:

```text
AI proposes, deterministic rules validate and reconcile, the adviser decides.
```

## Solution

Adviser Review Copilot runs a controlled workflow:

```text
simulated legacy CRM
-> adapter
-> allowlisted tools
-> deterministic skills
-> structured AI extraction
-> deterministic reconciliation
-> adviser confirmation/approval
-> persisted provenance and decision history
```

PostgreSQL seeded records simulate a legacy CRM. A backend adapter converts legacy-shaped records into the application's canonical domain model. The model provider proposes candidate facts from bounded source text, but trusted application code attaches source provenance, validates and reconciles the candidates, and applies deterministic lifecycle rules. Address changes require adviser confirmation; risk-profile changes require adviser approval.

## Key Capabilities

- Simulated legacy CRM adapter backed by PostgreSQL seed data.
- Controlled document ingestion for UTF-8 `.txt`, `.md`, and text-based `.pdf` files.
- OpenAI Responses API structured extraction, with deterministic mock mode for local demos and tests.
- Explicit skill and tool allowlists, Zod input/output validation, and safe error mapping.
- Official, previous, and candidate fact lifecycle with separate provenance for each state.
- Deterministic contradiction handling so same-field candidates are not selected by array order.
- Trusted freshness semantics based on source observation dates rather than adviser click timestamps.
- Human-in-the-loop confirmation and approval actions.
- Durable adviser decision snapshots preserving candidate value, evidence, source, official state before, resulting state, actor, and timestamp.
- Execution traces for preparation, upload, and decision workflows.
- PostgreSQL persistence through Prisma.
- Concurrency controls using `ClientFact.revision` compare-and-swap and `Client.mutationEpoch`.
- Unit, API/service, frontend, shared-contract, and PostgreSQL integration tests.
- GitHub Actions CI for Prisma generation, lint, type checking, tests, integration tests, and production build.

## Architecture

```mermaid
flowchart LR
  Web[React adviser workspace] --> API[Fastify API routes]
  API --> Harness[Execution harness]
  Harness --> Skills[Deterministic skills]
  Skills --> Tools[Allowlisted tools]
  Tools --> Legacy[Legacy CRM adapter]
  Tools --> Docs[Document ingestion tools]
  Tools --> Extractor[OpenAI provider or mock provider]
  Skills --> Rules[Reconciliation and domain rules]
  Legacy --> DB[(PostgreSQL)]
  Docs --> DB
  Rules --> DB
  Extractor --> Rules
```

The web page is the adviser-facing interface to the agent system; it does not call tools, run skills, or own promotion rules. The API composition root registers skills and tools, injects the Prisma-backed services, and exposes fixed routes for review preparation, upload, reset, and adviser decisions.

Supporting architecture notes:

- [Controlled model boundary](docs/architecture/model-boundary.md)
- [Controlled skills and execution harness](docs/architecture/skills-and-harness.md)

## Agent Context And Memory Lifecycle

The demo uses explicit, bounded context handling rather than conversational memory, embeddings, or vector search. The current architecture separates:

| Category | Meaning in this repo | Examples |
| --- | --- | --- |
| Working context | Temporary data used only during one execution | loaded client context, selected sources, extraction results, trusted candidate assertions, reconciliation intermediates, upload parsing data, in-memory execution events |
| Episodic history | Durable records of what happened | `WorkflowRun`, `WorkflowStep`, `AdviserDecision`, upload and preparation events, decision snapshots |
| Retrievable knowledge | Durable source material fetched when relevant | legacy CRM records, annual review records, adviser meeting notes, uploaded normalized documents |
| Persistent client state | Authoritative or pending domain state | official facts, previous facts, candidate facts, explicit fact provenance |
| Workflow state | Operational state, not memory | preparation status, ready-for-review status, requires-confirmation or requires-approval status, refresh-required responses, mutation guards |

Review preparation uses deterministic just-in-time retrieval:

```text
review concerns
-> deterministic bounded source selection
-> source-specific extraction
-> trusted provenance attachment
-> combined deterministic reconciliation
-> candidate projection
```

Source retrieval is application-owned policy over already-loaded trusted source records. It is not semantic search, conversational memory, summarisation, automatic deletion, memory decay, or a production retention system. Retention intent is documented at the model/type level: client fact state is permanent demo state, workflow and adviser decisions are audit/history, source records are review/source history, and raw parser/provider intermediates remain transient.

## Trust And Safety Boundaries

- Model output is untrusted proposal data.
- The model cannot select authoritative source IDs or observed dates.
- Trusted application code attaches provenance from the source record being processed.
- Model-provider code cannot execute SQL or access Prisma.
- Public routes do not accept arbitrary skill or tool names.
- Skills can call only explicitly allowlisted tools.
- High-impact changes require adviser approval before becoming official.
- Contradictory evidence is reconciled by deterministic application code, not by candidate order and not by asking the model to choose.
- Source retrieval is deterministic and bounded before extraction; the model cannot request additional sources.
- Post-commit refresh failure is reported as a saved decision requiring reload, not as a rolled-back mutation.
- Uploaded content, extracted PDF text, and filenames are treated as untrusted and displayed as plain text.
- Parser and provider errors are mapped to application-owned safe errors.

## Fact And Decision Lifecycle

Client facts distinguish three states:

- `official`: the current authoritative value and source.
- `previous`: the superseded value and source retained for history.
- `candidate`: the proposed value, source, date, and evidence awaiting adviser action.

Transitions:

- Confirming an address or approving a risk profile promotes the candidate to official and moves the prior official state to previous.
- Keeping current or leaving unverified clears the active candidate while retaining the official value.
- Every adviser decision stores an immutable structured snapshot of the candidate, candidate source/evidence, official state before, resulting state, actor (`demo-adviser` in this demo), and timestamp.

Legacy mirror fields (`sourceRecordId` and `observedAt`) remain temporarily for staged compatibility. The explicit official/previous/candidate provenance fields are the source of truth for current behavior.

## Concurrency And Consistency

- `ClientFact.revision` supports compare-and-swap updates for fact transitions.
- `Client.mutationEpoch` invalidates stale preparation, upload, and decision work after reset.
- Preparation, upload persistence, reset, and adviser decisions use client-scoped mutation coordination.
- Durable checks are repeated inside database transactions.
- Preparation can run extraction outside the transaction, but candidate projection, workflow run, and workflow steps commit together.
- Reset reseeds the demo in one PostgreSQL transaction.

These controls are practical consistency protections for this portfolio demo; they are not a formal proof of correctness or a substitute for production distributed-systems design.

## Supported Documents And Limits

Application-owned constants in [packages/shared/src/index.ts](packages/shared/src/index.ts) enforce current limits:

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

## Local Setup

### Prerequisites

- Node.js `22.13.0` (the CI version)
- npm
- Docker Desktop with Docker Compose

### Install

```bash
npm install
```

### Start PostgreSQL, Migrate, And Seed

PowerShell:

```powershell
$env:POSTGRES_PORT = "55432"
$env:DATABASE_URL = "postgresql://client_review:local_demo_password@localhost:55432/client_review_prep?schema=public"
$env:AI_MODE = "mock"

npm run db:up
npm run prisma:generate -w apps/api
npm run db:migrate
npm run db:seed
```

macOS/Linux shell:

```bash
export POSTGRES_PORT=55432
export DATABASE_URL="postgresql://client_review:local_demo_password@localhost:55432/client_review_prep?schema=public"
export AI_MODE=mock

npm run db:up
npm run prisma:generate -w apps/api
npm run db:migrate
npm run db:seed
```

The `55432` host port avoids a common conflict with a local PostgreSQL installation. Keep `POSTGRES_PORT` and the port in `DATABASE_URL` aligned.

### Run In Mock Mode

```bash
npm run dev
```

Open `http://localhost:5173`. The API health endpoint is `http://localhost:3001/health`.

Mock mode is the recommended default for public demos and local verification because it is deterministic and does not need network access or secrets.

### Optional Live OpenAI Mode

PowerShell:

```powershell
$env:AI_MODE = "openai"
$env:OPENAI_API_KEY = "<your key>"
$env:OPENAI_MODEL = "<configured model>"
npm run dev
```

macOS/Linux shell:

```bash
export AI_MODE=openai
export OPENAI_API_KEY="<your key>"
export OPENAI_MODEL="<configured model>"
npm run dev
```

Do not commit API keys or local `.env` files. If live extraction fails after valid configuration, the controlled tool falls back to mock extraction with a visible warning.

## Testing And Verification

Common release-quality checks:

```bash
npm run prisma:generate -w apps/api
npm run lint
npm run typecheck
npm test
npm run build
docker compose config
git diff --check
```

The PostgreSQL integration suite requires a migrated test database and `TEST_DATABASE_URL`:

```bash
npm run test:integration
```

It covers concurrent adviser decisions, reset/epoch conflicts, preparation/decision races, idempotent fact revisions, provenance transitions, durable decision snapshots, and transactional rollback behavior.

GitHub Actions provisions PostgreSQL, applies migrations, runs the integration suite, and runs Prisma generation, lint, type checking, unit tests, and production builds on pushes and pull requests targeting `main`. There is no continuous deployment.

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
`-- package.json          npm workspaces and scripts
```

## Scope And Limitations

This repository demonstrates a controlled financial-agent workflow with fictional data. It is not a production CRM integration, a system of record, a production compliance ledger, or financial advice.

Known limitations:

- Simulated legacy CRM, not live Xplan, Salesforce, or other commercial CRM integration.
- No production authentication, authorization, or multi-tenancy.
- Decision actor uses the stable demo identifier `demo-adviser`.
- Text-based PDFs only; no OCR for scanned PDFs.
- No production deployment or CD pipeline.
- Not financial, tax, or investment advice.
- Not a production-grade immutable audit ledger.
- OpenAI extraction can still be imperfect, so human review remains required.
- Legacy provenance mirror fields remain temporarily for staged compatibility.
- No claim that all commercial CRM schemas are supported.
- PDF parsing is timeout-bounded but not process-isolated.
- No malware scanning, object storage, database-backed retention metadata, automatic archiving/deletion, production observability, or incident response.

## Design Principles

- AI proposes; deterministic rules validate and reconcile.
- Evidence before mutation.
- Human approval for high-impact facts.
- Trusted provenance, not model-selected provenance.
- Bounded ingestion.
- Auditable execution.
- Honest demo constraints.
