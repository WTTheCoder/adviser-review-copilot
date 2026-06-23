CREATE TYPE "SourceRecordType" AS ENUM ('LEGACY_CRM', 'ANNUAL_REVIEW', 'ADVISER_MEETING_NOTE');
CREATE TYPE "LifecycleStatus" AS ENUM ('CURRENT', 'SUPERSEDED', 'NEEDS_CONFIRMATION', 'REQUIRES_ADVISER_APPROVAL');
CREATE TYPE "DecisionType" AS ENUM ('CONFIRM', 'LEAVE_UNVERIFIED', 'APPROVE', 'KEEP_CURRENT');
CREATE TYPE "WorkflowRunStatus" AS ENUM ('PREPARING', 'PREPARED', 'FAILED');
CREATE TYPE "WorkflowStepStatus" AS ENUM ('COMPLETE', 'ESCALATED', 'FAILED');

CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adviserName" TEXT NOT NULL,
    "reviewYear" INTEGER NOT NULL,
    "reviewStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "SourceRecordType" NOT NULL,
    "title" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "lifecycleStatus" "LifecycleStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientFact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "officialValue" TEXT NOT NULL,
    "candidateValue" TEXT,
    "previousValue" TEXT,
    "sourceRecordId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "confidence" TEXT NOT NULL,
    "lifecycleStatus" "LifecycleStatus" NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientFact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdviserDecision" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "factId" TEXT NOT NULL,
    "decisionType" "DecisionType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdviserDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" "WorkflowStepStatus" NOT NULL,
    "detail" TEXT,
    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SourceRecord_clientId_idx" ON "SourceRecord"("clientId");
CREATE INDEX "ClientFact_clientId_idx" ON "ClientFact"("clientId");
CREATE INDEX "ClientFact_sourceRecordId_idx" ON "ClientFact"("sourceRecordId");
CREATE INDEX "AdviserDecision_clientId_idx" ON "AdviserDecision"("clientId");
CREATE INDEX "AdviserDecision_factId_idx" ON "AdviserDecision"("factId");
CREATE INDEX "WorkflowRun_clientId_idx" ON "WorkflowRun"("clientId");
CREATE INDEX "WorkflowStep_workflowRunId_idx" ON "WorkflowStep"("workflowRunId");

ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientFact" ADD CONSTRAINT "ClientFact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientFact" ADD CONSTRAINT "ClientFact_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "SourceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdviserDecision" ADD CONSTRAINT "AdviserDecision_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdviserDecision" ADD CONSTRAINT "AdviserDecision_factId_fkey" FOREIGN KEY ("factId") REFERENCES "ClientFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
