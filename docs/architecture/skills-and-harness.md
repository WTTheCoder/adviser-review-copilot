# Controlled Skills and Execution Harness

The deterministic execution layer for the Client Review Prep Agent prepares adviser-facing reviews without giving model-provider code direct access to the database or unrestricted backend functions.

## Dependency Direction

```text
server.ts / application runtime composition
-> Fastify routes
-> ExecutionHarness
-> SkillRegistry
-> SkillDefinition
-> ToolRegistry
-> ToolDefinition
-> CandidateFactExtractor
-> services and adapters
-> Prisma/PostgreSQL
```

The composition root constructs the Prisma-backed review service, AI extractor, legacy adapter, registries, tools, skills, and harness before injecting route dependencies. Routes choose a known skill name and pass request data into the injected harness. Skills can only use tools listed in their `allowedTools`. Tools are the only harness-facing layer that calls services, adapters, or the candidate-fact extractor.

The React app consumes normal API responses and optional execution metadata. It does not call skills or tools directly.

## Execution Sequence

`POST /api/clients/:clientId/prepare-review` runs `prepare-annual-review`:

1. Validate skill input.
2. Create a persisted workflow run.
3. Load client context through legacy CRM tools.
4. Extract candidate facts through the controlled model boundary.
5. Classify extracted candidates through application rules.
6. Replace the current preparation candidate projection without promoting official values.
7. Reconcile facts deterministically.
8. Persist execution-trace steps.
9. Return the prepared review response with execution and extraction metadata.

`POST /api/clients/:clientId/facts/:factId/decision` runs `apply-adviser-decision`:

1. Validate skill input and adviser-decision payload.
2. Apply the decision through backend domain logic.
3. Return the updated review response with execution metadata.

`POST /api/clients/:clientId/source-records/upload` runs `ingest-client-document`:

1. Reject JSON bodies over the application-owned Fastify route limit before decoding or skill execution.
2. Validate the fixed route payload against the shared upload schema.
3. Discriminate TXT/Markdown from PDF using the application-owned request schema.
4. Validate TXT/Markdown through `document.validateTextUpload`, or validate PDF metadata, binary size, and signature through `document.validatePdfUpload`.
5. Extract bounded embedded PDF text through `document.extractPdfText`. OCR and filesystem access are not available.
6. Recheck the upload's per-client generation inside the serialized persistence boundary shared with reset.
7. Persist one normalized adviser meeting-note source record through `review.createUploadedSourceRecord`.
8. Return restrained upload metadata without echoing document text or PDF bytes in the execution trace.

The upload route does not expose arbitrary skill names, arbitrary tool names, server filesystem reads, or model-controlled file access.

## Skill and Tool Boundaries

Every skill declares:

- Name and optional version.
- Zod input and output schemas.
- Explicit allowed tool names.
- Deterministic execute function.

Every tool declares:

- Name.
- Zod input and output schemas.
- Risk label.
- Narrow execute function.

The harness rejects unknown skills, invalid skill inputs, invalid skill outputs, invalid tool inputs, invalid tool outputs, unknown tools, and tools outside the current skill allowlist.

Phase 6B1 document ingestion keeps one fixed route and one fixed skill. PDF parsing is isolated behind an application-owned wrapper around `unpdf`; tools receive in-memory data only, PDF.js string evaluation is disabled, and normalized extracted text is persisted only after all validation succeeds. Password/encryption classification comes from parser behavior, not lexical scans of arbitrary bytes. A 15-second application timeout bounds request waiting but does not provide CPU or memory isolation. Raw PDF bytes are never stored. The browser-supplied filename is display metadata only and is never used as a filesystem path.

Upload requests capture an in-memory per-client operation generation. Reset increments that generation inside the same serialized critical section used immediately before source-record persistence. An older upload therefore either commits before reset and is removed by reseeding, or observes the changed generation and cannot commit afterward. The browser also uses a synchronous submission lock and aborts its active request when reset begins. This coordination is intentionally single-process; horizontally scaled production deployments need database or distributed coordination.

## Legacy Adapter Rationale

The legacy CRM adapter simulates fragmented source systems while keeping the prototype deterministic. It gives future controlled skills a realistic backend boundary to operate through without exposing UI code to legacy-system details.

## Model Provider Boundary

Phase 5 model extraction operates through the registered `ai.extractCandidateFacts` tool and returns schema-validated candidate facts. Future model integrations should continue to select from registered skills or provide validated inputs to registered skills. Model-provider code must not call Prisma, database clients, or arbitrary services directly.

This keeps the future agent surface auditable:

- The set of callable skills is explicit.
- Each skill has a declared output contract.
- Each skill can only call allowlisted tools.
- Tool calls are validated and recordable.
- Errors returned to API consumers are safe and do not expose stack traces.

## Trade-offs

This layer adds some ceremony around a small model boundary. The benefit is a clear contract for agentic behavior and a small blast radius for future changes. Current tests remain deterministic so behavior can be covered without network calls, secrets, or model availability. Phase 6B2 should move complex or hostile PDF parsing to isolated asynchronous workers with process and memory limits; the current timeout only stops the API from waiting indefinitely.
