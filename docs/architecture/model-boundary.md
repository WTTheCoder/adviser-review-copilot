# Controlled Model Boundary

Adviser Review Copilot treats model output as untrusted proposal data. The model can suggest candidate facts, but it cannot choose authoritative provenance, promote official facts, execute SQL, or decide high-impact changes.

## Boundary

```text
prepare-annual-review skill
-> deterministic bounded source retrieval
-> ai.extractCandidateFacts tool
-> CandidateFactExtractor
-> mock provider or OpenAI provider
-> trusted provenance attachment
-> deterministic reconciliation
-> candidate projection
```

The provider receives no Prisma client, Fastify server, React state, tool registry, skill registry, database rows, adviser decisions, workflow traces, API keys, environment configuration, raw PDF bytes, parser internals, local filesystem paths, upload internals, or unrelated records.

## Data Sent To Live Extraction

Only bounded source context from selected sources crosses the model boundary:

- safe client display name;
- source record ID and type as context only;
- observed date as context only;
- normalized source text capped by application limits;
- supported candidate fields.

Uploaded PDFs are identified as `UPLOADED_PDF`; only extracted plain text is sent. Raw PDF bytes are never sent to the model.

## Deterministic Source Retrieval

Preparation does not send all source records blindly to the extractor. It first applies application-owned retrieval policy to the trusted source records already loaded for the client:

```text
supported fact fields
+ source record type and upload metadata
+ conservative text hints
-> relevance score
-> deterministic bounded selected sources
-> one extraction call per selected source
```

The policy sorts selected sources by relevance score, trusted observation date, and source ID. If no field hints match, it uses a conservative fallback to the latest eligible adviser note or uploaded source rather than loading every record. This is deterministic retrieval, not vector search or semantic memory.

Each selected source is extracted separately so provenance is not mixed. The model can see the selected source ID and observed date as context, but trusted application code still attaches those values after extraction. Candidate assertions from all selected sources are then reconciled together, preserving cross-source contradiction handling.

## Structured Output Validation

Zod schemas define supported fields, candidate limits, evidence limits, confidence values, date format, and strict object shapes. The OpenAI provider uses the Responses API with the SDK `zodTextFormat` helper, then validates parsed output again with application-owned schemas.

Unsupported fields, excessive candidate counts, malformed dates, extra properties, and overlong evidence are rejected before candidate reconciliation.

## Trusted Provenance

The model cannot select authoritative source IDs or observed dates. Candidate facts returned by either mock or live extraction are provenance-free proposals. After extraction, trusted application code attaches:

- `sourceRecordId` from the source record being processed;
- `observedDate` from the trusted source record.

Model-provided or forged provenance fields are ignored. Official, previous, and candidate fact states each have explicit provenance fields; the legacy `sourceRecordId` and `observedAt` mirrors remain only for staged compatibility.

## Prompt Injection Treatment

Source text, including uploaded `.txt`, `.md`, and extracted `.pdf` content, is untrusted. The prompt states that source text is data, not instructions, and wraps it in `<source_document>` delimiters. A document cannot choose skills, select tools, approve facts, change schemas, access secrets, read files, or update the database.

## Mock And Live Modes

`AI_MODE=mock` is deterministic and works offline. It is the recommended mode for demos and tests.

`AI_MODE=openai` uses the official OpenAI SDK and Responses API. It requires `OPENAI_API_KEY` and `OPENAI_MODEL`.

If live extraction fails after valid OpenAI configuration, the controlled tool falls back to mock extraction with a visible warning. The workflow trace distinguishes normal mock mode from mock fallback and never claims fallback output came from OpenAI.

## Deterministic Reconciliation

Application rules group candidate assertions by field before projection. They distinguish:

- equivalent duplicate assertions, which merge evidence deterministically;
- candidate values that differ from the official value;
- assertions that support the current official value;
- mutually conflicting proposed values;
- unsupported, negated, rejected, or retained-current language.

Contradictory same-field evidence is withheld rather than selected by array order. The API returns a warning and leaves the current official state unchanged. High-impact fields such as risk profile still require adviser approval for supported candidates.

Risk profile uses a small application-owned taxonomy in this prototype: `Conservative`, `Balanced`, `Growth-oriented`, and `High Growth`. Address extraction and mock-mode phrase handling are deliberately conservative and are not production NLP.

## Freshness Semantics

Freshness is based on trusted source observation dates, not on adviser decision timestamps. A candidate source must be newer than the official provenance to reopen or replace candidate state. Equal-date conflicting evidence is withheld; equal-date same-value evidence creates no churn. Missing dates are handled conservatively rather than inventing model-provided dates.

Adviser decision timestamps remain useful for audit ordering, but they are not evidence that the underlying source is newer.

## Candidate Projection And Persistence

Preparation replaces the current address/risk-profile candidate projection for the run without promoting official values. Empty extraction clears active candidates while leaving official values unchanged. Financial-goal and numeric candidates remain advisory until deterministic normalization and validation are expanded.

The adviser-facing summary metrics are derived from the final review projection. `Items needing confirmation` counts facts in `NEEDS_CONFIRMATION` or `REQUIRES_ADVISER_APPROVAL`; it returns to zero after adviser decisions resolve those items.

## What Is Not Persisted

The application does not persist API keys, chain of thought, raw provider payloads, raw prompts, raw PDF bytes, or duplicate meeting-note text in workflow traces. Uploaded normalized text is stored only after validation succeeds.

Working context such as selected sources, extraction results, reconciliation intermediates, parser bytes, and in-memory execution events is temporary unless it is deliberately transformed into durable source records, workflow rows, candidate fact state, or adviser decision snapshots.

## Known Limitations

This boundary is designed for a fictional portfolio demo, not regulatory compliance. Future production work would need authentication, tenant isolation, live-model evaluation, richer diagnostics, production observability, parser isolation, malware scanning, database-backed retention controls if required, OCR if required, and broader deterministic normalization. It does not implement conversational memory, embeddings, a vector database, automatic deletion, or memory decay.
