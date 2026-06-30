# Controlled Skills And Execution Harness

The deterministic execution layer for Adviser Review Copilot prepares client reviews without giving model-provider code direct database access or unrestricted backend functions.

## Dependency Direction

```text
application runtime composition
-> Fastify routes
-> ExecutionHarness
-> SkillRegistry
-> SkillDefinition
-> ToolRegistry
-> ToolDefinition
-> services and adapters
-> Prisma/PostgreSQL
```

The composition root constructs the Prisma-backed review service, AI extractor, legacy adapter, registries, tools, skills, and harness before injecting route dependencies. Routes choose known skill names and pass request data into the injected harness. Skills can call only the tools listed in their `allowedTools`. Tools are the harness-facing layer that calls services, adapters, and the candidate extractor.

The React app consumes API responses and execution metadata. It does not call skills or tools directly.

## Fixed Public Routes

The API exposes fixed workflow routes rather than an arbitrary public skill endpoint:

- `POST /api/clients/:clientId/prepare-review`
- `POST /api/clients/:clientId/facts/:factId/decision`
- `POST /api/clients/:clientId/source-records/upload`
- `POST /api/demo/reset`

Public callers cannot submit arbitrary skill names, tool names, SQL, provider prompts, or filesystem paths.

## Review Preparation

`prepare-annual-review` remains the internal skill name for compatibility. It performs a generic client-review preparation workflow:

1. Validate skill input.
2. Capture the durable `Client.mutationEpoch`.
3. Load client, source records, and facts through legacy CRM tools.
4. Select bounded relevant source records using deterministic retrieval policy.
5. Extract candidate facts from each selected source through the controlled model boundary.
6. Attach trusted source provenance in application code.
7. Reconcile duplicate, contradictory, stale, unsupported, and official-supporting assertions across all selected sources.
8. Commit the candidate projection, review status, workflow run, and workflow steps in one transaction.
9. Return the prepared review response with execution and extraction metadata.

Candidate projection uses explicit official/candidate provenance and `ClientFact.revision` compare-and-swap. Reprocessing identical evidence is idempotent.

## Context And History Classification

The harness and skills separate temporary working context from durable history and state:

| Category | Scope |
| --- | --- |
| Working context | loaded client context, selected sources, extraction results, trusted candidate assertions, reconciliation intermediates, temporary document parsing data, and in-memory execution events |
| Episodic history | `WorkflowRun`, `WorkflowStep`, upload/preparation events, `AdviserDecision`, and durable decision snapshots |
| Retrievable knowledge | legacy CRM source records, annual review records, adviser meeting notes, and uploaded normalized documents |
| Persistent client state | official, previous, and candidate fact values with explicit provenance |
| Workflow state | preparation status, ready-for-review state, lifecycle status, refresh-required state, and mutation guards; this is operational state, not memory |

This classification is architectural documentation and narrow runtime policy. It does not add database columns, retention jobs, automatic archiving, conversational memory, or a summarisation pipeline.

## Just-In-Time Source Retrieval

Source retrieval happens after source records are loaded through allowlisted tools and before extraction. The policy uses only trusted application data: supported fact fields, source type, safe upload metadata, source title/summary, bounded normalized source lines, and conservative keyword hints. Source type alone does not make a record relevant.

The retrieval step selects a small bounded set of sources, preserving source ID and observed date. The preparation skill calls the existing extractor once per selected source, then attaches each source's trusted provenance separately. The existing deterministic reconciliation receives all trusted assertions together, so cross-source contradictions remain visible.

Execution traces include the number of source records considered, the selected source IDs, relevant fields/reasons, and whether fallback was used. They do not include raw source text.

## Adviser Decisions

`apply-adviser-decision` persists address confirmation, address leave-unverified, risk-profile approval, and risk-profile keep-current decisions.

Inside one PostgreSQL transaction it:

1. Reads the unresolved fact.
2. Validates the requested decision against the fact type and lifecycle.
3. Locks the durable `Client.mutationEpoch`.
4. Updates the fact using `ClientFact.revision` compare-and-swap.
5. Writes an `AdviserDecision` row with a structured immutable snapshot.
6. Writes the workflow run and mandatory workflow steps.

The decision snapshot stores candidate value, candidate source, candidate observed date, candidate evidence, official state before, resulting official state, actor (`demo-adviser` in this demo), and timestamp. KEEP_CURRENT and LEAVE_UNVERIFIED can clear active candidate state because the candidate and evidence remain in the durable snapshot.

After the transaction commits, the service attempts to build a refreshed review response. If that post-commit refresh fails, the API reports a committed success with `refreshRequired: true` and a reload message. It does not imply rollback and does not repeat the mutation automatically.

Concurrent decisions for the same candidate transition cannot both complete. The losing request receives the application-owned `DECISION_CONFLICT` response with HTTP 409 and does not create a decision or mutate the fact.

## Document Upload

`ingest-client-document` handles one `.txt`, `.md`, or text-based `.pdf` source:

1. Reject route bodies over the configured limit before decoding.
2. Validate the fixed route payload against the shared upload schema.
3. Validate TXT/Markdown text or PDF metadata, binary size, and signature.
4. Extract bounded embedded PDF text through the application-owned wrapper around `unpdf`.
5. Recheck `Client.mutationEpoch` inside the serialized persistence boundary.
6. Persist one normalized adviser meeting-note source record.
7. Return restrained metadata without echoing document text or PDF bytes in the execution trace.

PDF parsing is in-memory and timeout-bounded, but not process-isolated. Raw PDF bytes are never stored. Browser filenames are display metadata only and are never used as filesystem paths.

## Reset, Mutation Epoch, And Revision Controls

Uploads, preparation, adviser decisions, and reset use one client-scoped mutation coordinator in the API process. Durable database checks remain authoritative:

- reset reseeds the complete demo inside one PostgreSQL transaction;
- `Client.mutationEpoch` invalidates stale upload, preparation, and decision work after reset;
- `ClientFact.revision` protects fact updates with compare-and-swap;
- preparation, reset, and decision rollback tests verify that partial audit or workflow writes do not survive failed transactions.

The in-memory coordinator reduces same-process overlap, but it is not a distributed lock.

## Skill And Tool Contracts

Every skill declares:

- name and optional version;
- Zod input and output schemas;
- explicit allowed tool names;
- deterministic execute function.

Every tool declares:

- name;
- Zod input and output schemas;
- risk label;
- narrow execute function.

The harness rejects unknown skills, invalid skill inputs, invalid skill outputs, invalid tool inputs, invalid tool outputs, unknown tools, and tools outside the current skill allowlist.

## Legacy Adapter Rationale

The legacy CRM adapter simulates fragmented source systems while keeping the prototype deterministic. It gives controlled skills a realistic backend boundary without spreading legacy-system details through routes or UI code.

## Trade-offs

This layer adds ceremony around a small model and workflow boundary. The benefit is a small blast radius for future agentic behavior: skills are explicit, tool access is allowlisted, outputs are validated, and errors returned to API consumers are safe. Production work would still need authentication, distributed coordination, isolated document-processing workers, live-model evaluation, and operational monitoring.
