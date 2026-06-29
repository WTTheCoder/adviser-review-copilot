# Adviser Review Copilot Demo

All names and records in this walkthrough are fictional.

## 30-Second Pitch

Adviser Review Copilot helps financial advisers prepare client reviews from fragmented CRM records, prior review data, meeting notes, and client documents. AI can identify evidence-backed candidate changes, but deterministic rules validate and reconcile the proposals before an adviser confirms or approves anything. Source provenance, execution traces, and durable decision history stay visible.

## 3-Minute Demo

1. Open `http://localhost:5173` and confirm the API status is connected.
2. Select **Reset local demo data**.
3. Show the CRM baseline for Alex Taylor: `East Perth` and `Balanced`.
4. Upload `demo/alex-taylor-update.txt` with today's observed date.
5. Expand **View upload execution trace** to show bounded ingestion.
6. Select **Prepare Client Review**.
7. Point out the address and High Growth candidates and the unresolved metrics.
8. Open **Evidence and Memory** for each candidate and identify the uploaded source.
9. Expand the preparation execution trace.
10. Confirm the address and approve the risk-profile change.
11. Refresh the browser.
12. Show that the decisions remain selected, the new values are official, and `East Perth` and `Balanced` remain visible as previous history.
13. Reset once more so the next demonstration starts cleanly.

## 5-Minute Technical Explanation

- **Skills:** typed workflows coordinate context loading, ingestion, review preparation, reconciliation, and adviser decisions.
- **Allowlisted tools:** each skill can call only registered operations appropriate to that workflow.
- **Legacy adapter:** simulated CRM access is isolated behind a backend boundary rather than spread through routes or UI code.
- **Document ingestion:** TXT, Markdown, and text-based PDF inputs are validated, bounded, normalized, and stored as source records. Raw PDF bytes are not retained.
- **Extraction modes:** deterministic mock mode supports repeatable offline demos; optional OpenAI Responses API mode implements the same candidate contract.
- **Candidate facts:** extracted values remain proposals. Trusted application code attaches provenance, then deterministic rules own canonicalization, lifecycle state, metrics, and promotion.
- **Contradiction handling:** same-field contradictions are withheld with warnings rather than chosen by array order.
- **Human approval:** address changes require confirmation and risk-profile changes require approval.
- **Decision history:** KEEP_CURRENT and LEAVE_UNVERIFIED clear active candidate state, but the durable decision snapshot retains candidate value, source, evidence, official-before state, result, actor, and timestamp.
- **Auditability:** evidence, source attribution, skill execution metadata, workflow steps, and persisted adviser decisions survive refresh.
- **Security boundaries:** request and document limits, safe error mapping, plain-text display, tool allowlists, trusted provenance attachment, and reset/upload coordination constrain the prototype. PDF parsing is timed out but not process-isolated.

## Failure Recovery

### Database Is Not Running

Set `POSTGRES_PORT` and `DATABASE_URL` as shown in the README, run `npm run db:up`, wait for PostgreSQL to become healthy, then run migrations and seed if this is the first start.

### API Is Disconnected

Confirm `npm run dev` is still running, open `http://localhost:3001/health`, and verify `VITE_API_BASE_URL` has not been set to a different API URL.

### Decision Was Saved But The Review Did Not Refresh

If the app shows that the decision was saved and asks you to refresh, reload the page. The mutation has committed; the message means the post-commit readback failed.

### Reset Fails

Confirm the database and API are running. Retry **Reset local demo data**. For a full local rebuild, stop the dev servers and run `npm run db:reset`, then restart `npm run dev`.

### Selected File Is Unsupported

Use a UTF-8 `.txt`, `.md`, or text-based `.pdf` file within the documented limits. Other extensions are intentionally rejected.

### A Scanned PDF Is Uploaded

The application will report that usable text is unavailable. Generate a PDF with embedded selectable text from `demo/alex-taylor-pdf-source.md`, or use the supplied TXT/Markdown samples. OCR is intentionally outside the current scope.
