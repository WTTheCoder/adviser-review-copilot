# Client Review Prep Agent

Client Review Prep Agent is a prototype for financial advisers preparing annual client reviews. The long-term direction is to prepare source-backed review material from fragmented legacy CRM records, review documents, and meeting notes.

This repository is not a production financial-advice system and does not contain real customer data, proprietary branding, or model-provider integrations.

## Current Milestone

Phase 4 adds a deterministic controlled-skills execution layer while preserving the adviser-facing React workspace and PostgreSQL-backed Phase 3 behavior. Review preparation and adviser decisions now route through a typed execution harness with registered skills, registered tools, allowlists, Zod validation, safe failure responses, and visible execution metadata.

OpenAI, model-provider orchestration, dynamic skills, authentication, document upload, PDF parsing, and real financial recommendations are still deferred.

## Architecture

```text
React adviser workspace
-> Node.js review API
-> controlled execution harness
-> registered skills
-> allowlisted tools
-> review service
-> controlled legacy CRM adapter
-> PostgreSQL
```

The legacy CRM adapter is a deliberate backend boundary. It simulates an existing legacy CRM that controlled skills operate through. The adviser-facing application does not require users to navigate that legacy system directly.

Phase 4 skills are deterministic TypeScript modules, not model prompts. The harness validates skill inputs, enforces tool allowlists, validates tool and skill outputs, records execution events, and returns safe error messages.

## Repository Structure

- `apps/web`: React, TypeScript, Vite, and Tailwind CSS frontend.
- `apps/api`: Node.js, TypeScript, Fastify API, controlled execution harness, deterministic skills/tools, Prisma schema, migrations, and seed script.
- `packages/shared`: Shared TypeScript types and Zod schemas for API contracts.
- `docs/architecture`: Architecture notes for the controlled skills and harness boundary.
- `.github/workflows/ci.yml`: CI for lint, type checking, tests, and builds.
- `docker-compose.yml`: Local PostgreSQL service for the demo.

## Installation

```bash
npm install
```

Copy `.env.example` to `.env` if you want local environment variables available in your shell. `.env` remains ignored by Git.

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
- `POST /api/clients/:clientId/facts/:factId/decision`: Persists one adviser decision and lets backend domain logic update fact state.
- `POST /api/demo/reset`: Local demonstration reset for the fictional Alex Taylor data.

The reset endpoint is for local demonstration only.

## Controlled Skills and Tools

Registered skills:

- `load-client-context`: Loads a client, source records, and known facts through legacy CRM tools.
- `reconcile-client-facts`: Reconciles loaded facts into adviser-review items.
- `prepare-annual-review`: Coordinates review preparation, workflow trace persistence, and review response generation.
- `apply-adviser-decision`: Applies one adviser decision through deterministic backend domain rules.

Registered tools:

- `legacy.getClient`
- `legacy.getSourceRecords`
- `legacy.getFacts`
- `review.createWorkflowRun`
- `review.recordWorkflowStep`
- `review.getPreparedReview`
- `review.applyDecision`

The frontend displays the selected or executed skill in the review workspace and keeps the existing execution trace visible. Re-running preparation is supported; repeated runs create a new workflow run without duplicating seeded facts or source records.

## Demonstration Workflow

The seeded demo uses one fictional client, Alex Taylor, advised by Jordan Lee for the 2026 Annual Review. It loads three source records: a 2023 legacy CRM record, a 2025 annual review, and a 2026 adviser meeting note.

The workflow persists preparation results, adviser decisions, and audit trace records in PostgreSQL. Refreshing the browser after preparation or after adviser decisions keeps the persisted state visible.

## Later Milestones

OpenAI and model-selected skills are intentionally not included in this milestone. Future phases can add model routing behind the harness, richer validation policies, authentication, document ingestion, and deployment hardening.
