# Client Review Prep Agent

Client Review Prep Agent is a prototype for financial advisers preparing annual client reviews. The long-term direction is to prepare source-backed review material from fragmented legacy CRM records, review documents, and meeting notes.

This repository is not a production financial-advice system and does not contain real customer data, proprietary branding, or model-provider integrations.

## Current Milestone

Phase 3 converts the Phase 2 static presentation demo into a PostgreSQL-backed application while preserving the adviser-facing React workspace. It introduces persistence, Prisma migrations, seed data, REST endpoints, a simulated legacy CRM adapter, persistent adviser decisions, and an auditable deterministic workflow trace.

OpenAI, dynamic skills, authentication, document upload, PDF parsing, and real financial recommendations are still deferred.

## Architecture

```text
React adviser workspace
-> Node.js review API
-> review service
-> controlled legacy CRM adapter
-> PostgreSQL
```

The legacy CRM adapter is a deliberate backend boundary. It simulates an existing legacy CRM that future controlled agent skills could operate through. The adviser-facing application does not require users to navigate that legacy system directly.

## Repository Structure

- `apps/web`: React, TypeScript, Vite, and Tailwind CSS frontend.
- `apps/api`: Node.js, TypeScript, Fastify API, Prisma schema, migrations, and seed script.
- `packages/shared`: Shared TypeScript types and Zod schemas for API contracts.
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

## Demonstration Workflow

The seeded demo uses one fictional client, Alex Taylor, advised by Jordan Lee for the 2026 Annual Review. It loads three source records: a 2023 legacy CRM record, a 2025 annual review, and a 2026 adviser meeting note.

The workflow persists preparation results, adviser decisions, and audit trace records in PostgreSQL. Refreshing the browser after preparation or after adviser decisions keeps the persisted state visible.

## Later Milestones

OpenAI and dynamic controlled skills are intentionally not included in this milestone. Future phases can add agent-operated legacy tools, richer validation harnesses, authentication, document ingestion, and deployment hardening.
