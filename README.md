# Client Review Prep Agent

Client Review Prep Agent is a prototype for financial advisers preparing annual client reviews. The longer-term product will collect fragmented legacy CRM records, review documents, and meeting notes, then help advisers prepare source-backed annual review material.

## Current Milestone

Phase 2 adds a static, deterministic adviser-review demonstration for a fictional client, Alex Taylor. The demo shows how source records can be reconciled into a current client picture, how superseded information remains visible as history, and how adviser approval is requested for unverified or high-impact changes.

The workflow is presentation-focused only. It does not call AI, update a production CRM, generate financial advice, or use real customer data. PostgreSQL, OpenAI integration, document ingestion, and production workflow features will be added in later milestones.

## Repository Structure

- `apps/web`: React, TypeScript, Vite, and Tailwind CSS frontend.
- `apps/api`: Node.js, TypeScript, and Fastify API.
- `packages/shared`: Shared TypeScript types and Zod schemas.

## Installation

```bash
npm install
```

Copy `.env.example` to `.env` if you want to customize local ports or API URLs.

## Development Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run dev` starts both the frontend and backend.

GitHub Actions runs lint, type checking, tests, and production builds for pushes and pull requests targeting `main`.

## Local URLs

- Web app: `http://localhost:5173`
- API health: `http://localhost:3001/health`

## Static Demonstration Workflow

The frontend loads three fictional source records: a 2023 legacy CRM record, a 2025 annual review, and a 2026 adviser meeting note. Selecting **Prepare Client Review** reveals summary metrics, a current client picture, meaningful changes, adviser confirmation actions, evidence details for each fact, and a secondary execution trace.

## Later Milestones

PostgreSQL persistence and OpenAI API support are intentionally not included in this milestone. They will be added once the review workflow and data boundaries are ready.
