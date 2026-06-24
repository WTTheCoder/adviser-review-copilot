# Controlled Model Boundary

Phase 5 adds a small candidate-fact extraction boundary. The model is not an authority and cannot update official facts.

## Trust Boundary

```text
prepare-annual-review skill
-> ai.extractCandidateFacts tool
-> CandidateFactExtractor
-> mock provider or OpenAI provider
```

The provider does not receive Prisma, Fastify, React, `ToolRegistry`, or `SkillRegistry`.

## Data Sent In Live Mode

Only the minimum source context is sent: safe client display name, source record ID and type, observed date, bounded normalized source text, and supported candidate fields. Uploaded PDFs are identified as `UPLOADED_PDF`; only extracted plain text crosses the model boundary. The provider does not receive raw PDF bytes, parser internals, embedded metadata, browser paths, local server paths, upload internals, database rows, adviser decisions, workflow traces, or unrelated records.

The implementation does not send API keys, audit history, complete database rows, adviser decisions, workflow traces, unrelated records, or environment configuration.

## Structured Output Validation

Zod schemas define supported fields, candidate limits, evidence limits, date format, confidence values, and strict object shapes. The OpenAI provider uses the Responses API with the SDK `zodTextFormat` helper, then validates parsed output again with application-owned Zod schemas.

Unsupported fields, excessive candidates, malformed dates, extra properties, and excessive evidence are rejected.

## Prompt Injection Treatment

Source text, including uploaded `.txt`, `.md`, and extracted `.pdf` content, is untrusted. The prompt explicitly states that source text is data, not instructions, and wraps it in `<source_document>` delimiters. A document cannot choose skills, select tools, access secrets, approve facts, change schemas, read files, or update the database.

## Mock And Live Modes

`AI_MODE=mock` is the default and works offline. It deterministically extracts the fictional Subiaco address, growth-oriented risk profile, and near-term home-purchase goal candidates from the seeded adviser meeting note.

`AI_MODE=openai` uses the official OpenAI SDK and Responses API. It requires `OPENAI_API_KEY` and `OPENAI_MODEL`.

If live extraction fails after valid OpenAI configuration, the controlled tool falls back to mock extraction with a visible warning. It never claims fallback output came from OpenAI, and the workflow trace distinguishes normal mock mode from mock fallback.

## Application Authority

Application rules override model claims:

- Address candidates stay pending confirmation.
- Risk-profile candidates require adviser approval.
- Financial-goal candidates stay advisory in this phase because the verified annual review remains the source of truth.
- Numeric values must be validated by deterministic code before future use.

The model cannot directly promote official facts or perform financial calculations.

## Candidate Projection And Persistence

The preparation skill maps validated extraction output through deterministic classification and then updates the existing demo `ClientFact` rows as the current preparation candidate projection. This avoids duplicate facts and keeps adviser decisions compatible with the existing backend rules.

Empty extraction deliberately clears the address and risk-profile candidate projection for the run, leaving official values unchanged. Repeated preparation replaces the projection rather than appending facts. If an adviser decision is newer than the extracted evidence date, preparation does not resurrect that candidate from the same older evidence.

Financial-goal and numeric candidates are not promoted automatically. Numeric fields remain advisory until deterministic normalization and validation are expanded in a later phase.

## Risk-Profile Normalization

Risk profile is a controlled application-owned taxonomy in this prototype. The supported canonical values are `Conservative`, `Balanced`, `Growth-oriented`, and `High Growth`.

The model may return natural-language evidence such as "more growth-oriented investment approach", but application domain logic normalizes supported phrases before candidate projection. Deterministic mock extraction collects ordered, bounded risk-relevant sentences within one source record and applies one application-owned aggregate intent classification before emitting a candidate. Negated, rejected, retained-current, contradictory evidence, and multiple different proposed canonical values are omitted rather than projected as positive changes. Supported and genuinely uncertain high-impact candidates still require adviser approval.

This taxonomy and sentence-level English intent handling are intentionally small for the fictional demo and are not production NLP. Conflict handling is source-record scoped; cross-source reconciliation continues to use the existing deterministic source selection and remains future work.

## Summary Metrics

The adviser-facing summary metrics are derived from the final review projection returned in the same response. `Items needing confirmation` is a combined unresolved-review count: facts currently in `NEEDS_CONFIRMATION` or `REQUIRES_ADVISER_APPROVAL`. It is zero when extraction returns no address or risk-profile candidate, and it returns to zero after adviser decisions resolve those items.

`Meaningful changes` includes the verified historical changes in the fictional annual-review data plus currently visible candidate changes from the preparation projection. Empty extraction does not add candidate-driven changes.

Phase 5 reuses workflow trace entries and backwards-compatible response metadata. It does not persist API keys, chain of thought, raw provider payloads, raw prompts, or duplicate meeting-note text.

## Known Limitations

This is not production-ready and does not claim regulatory compliance. Phase 6B2 should address OCR for scanned PDFs. Later work should review DOCX parsing, malware scanning, retention policy, production object storage, authentication, live-model evaluation, richer diagnostics, stricter provider observability, and deterministic numeric normalization before expanding extraction beyond the fictional demo.
