ALTER TABLE "ClientFact"
ADD COLUMN "officialSourceRecordId" TEXT,
ADD COLUMN "officialObservedAt" TIMESTAMP(3),
ADD COLUMN "previousSourceRecordId" TEXT,
ADD COLUMN "previousObservedAt" TIMESTAMP(3),
ADD COLUMN "candidateSourceRecordId" TEXT,
ADD COLUMN "candidateObservedAt" TIMESTAMP(3),
ADD COLUMN "candidateEvidence" TEXT;

UPDATE "ClientFact"
SET
  "officialSourceRecordId" = "sourceRecordId",
  "officialObservedAt" = "observedAt",
  "candidateSourceRecordId" = CASE
    WHEN "candidateValue" IS NOT NULL THEN "sourceRecordId"
    ELSE NULL
  END,
  "candidateObservedAt" = CASE
    WHEN "candidateValue" IS NOT NULL THEN "observedAt"
    ELSE NULL
  END;

ALTER TABLE "ClientFact"
ALTER COLUMN "officialSourceRecordId" SET NOT NULL,
ALTER COLUMN "officialObservedAt" SET NOT NULL;

CREATE INDEX "ClientFact_officialSourceRecordId_idx" ON "ClientFact"("officialSourceRecordId");
CREATE INDEX "ClientFact_previousSourceRecordId_idx" ON "ClientFact"("previousSourceRecordId");
CREATE INDEX "ClientFact_candidateSourceRecordId_idx" ON "ClientFact"("candidateSourceRecordId");

ALTER TABLE "ClientFact" ADD CONSTRAINT "ClientFact_officialSourceRecordId_fkey" FOREIGN KEY ("officialSourceRecordId") REFERENCES "SourceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientFact" ADD CONSTRAINT "ClientFact_previousSourceRecordId_fkey" FOREIGN KEY ("previousSourceRecordId") REFERENCES "SourceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientFact" ADD CONSTRAINT "ClientFact_candidateSourceRecordId_fkey" FOREIGN KEY ("candidateSourceRecordId") REFERENCES "SourceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
