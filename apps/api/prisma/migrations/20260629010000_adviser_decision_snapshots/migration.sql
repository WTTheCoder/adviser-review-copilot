-- Add nullable structured snapshots for adviser decisions.
-- Existing rows remain valid with null snapshot fields because their full
-- candidate and provenance state cannot be reconstructed reliably from notes.
ALTER TABLE "AdviserDecision"
  ADD COLUMN "actor" TEXT,
  ADD COLUMN "candidateValue" TEXT,
  ADD COLUMN "candidateSourceRecordId" TEXT,
  ADD COLUMN "candidateObservedAt" TIMESTAMP(3),
  ADD COLUMN "candidateEvidence" TEXT,
  ADD COLUMN "officialValueBefore" TEXT,
  ADD COLUMN "officialSourceRecordIdBefore" TEXT,
  ADD COLUMN "officialObservedAtBefore" TIMESTAMP(3),
  ADD COLUMN "resultingOfficialValue" TEXT,
  ADD COLUMN "resultingOfficialSourceRecordId" TEXT,
  ADD COLUMN "resultingOfficialObservedAt" TIMESTAMP(3);

CREATE INDEX "AdviserDecision_candidateSourceRecordId_idx"
  ON "AdviserDecision"("candidateSourceRecordId");

CREATE INDEX "AdviserDecision_officialSourceRecordIdBefore_idx"
  ON "AdviserDecision"("officialSourceRecordIdBefore");

CREATE INDEX "AdviserDecision_resultingOfficialSourceRecordId_idx"
  ON "AdviserDecision"("resultingOfficialSourceRecordId");

ALTER TABLE "AdviserDecision"
  ADD CONSTRAINT "AdviserDecision_candidateSourceRecordId_fkey"
  FOREIGN KEY ("candidateSourceRecordId") REFERENCES "SourceRecord"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdviserDecision"
  ADD CONSTRAINT "AdviserDecision_officialSourceRecordIdBefore_fkey"
  FOREIGN KEY ("officialSourceRecordIdBefore") REFERENCES "SourceRecord"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdviserDecision"
  ADD CONSTRAINT "AdviserDecision_resultingOfficialSourceRecordId_fkey"
  FOREIGN KEY ("resultingOfficialSourceRecordId") REFERENCES "SourceRecord"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
