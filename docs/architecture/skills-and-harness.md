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

This layer adds some ceremony around a small model boundary. The benefit is a clear contract for agentic behavior and a small blast radius for future changes. Current tests remain deterministic so behavior can be covered without network calls, secrets, or model availability.
