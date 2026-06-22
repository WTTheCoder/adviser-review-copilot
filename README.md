# Client Review Prep Agent

Client Review Prep Agent is a prototype for financial advisers preparing annual client reviews. The longer-term product will collect fragmented legacy CRM records, review documents, and meeting notes, then help advisers prepare source-backed annual review material.

## Current Milestone

Phase 1 creates a clean frontend/backend foundation only. It includes a React web app, a Fastify API, and shared TypeScript/Zod health response definitions. PostgreSQL, OpenAI integration, document ingestion, and review workflow features will be added in later milestones.

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

## Later Milestones

PostgreSQL persistence and OpenAI API support are intentionally not included in this milestone. They will be added once the review workflow and data boundaries are ready.
