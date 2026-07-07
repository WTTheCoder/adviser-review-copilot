import {
  DecisionType,
  LifecycleStatus,
  PrismaClient,
  SourceRecordType,
  WorkflowStepStatus
} from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoData, DEMO_CLIENT_ID } from "../demo/seedDemoData.js";
import { ClientOperationCoordinator } from "./clientOperationCoordinator.js";
import {
  ClientMutationConflictError,
  createReviewService,
  DecisionConflictError,
  type ExtractedCandidateProjection
} from "./reviewService.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests.");
}

const primary = new PrismaClient({ datasourceUrl: databaseUrl });
const secondary = new PrismaClient({ datasourceUrl: databaseUrl });

const resetCanonicalData = () =>
  primary.$transaction((transaction) => seedDemoData(transaction));

const factState = (factId: string) =>
  primary.clientFact.findUniqueOrThrow({ where: { id: factId } });

const latestDecision = (factId: string) =>
  primary.adviserDecision.findFirstOrThrow({
    where: { factId },
    orderBy: { createdAt: "desc" }
  });

const clientEpoch = () =>
  primary.client
    .findUniqueOrThrow({
      where: { id: DEMO_CLIENT_ID },
      select: { mutationEpoch: true }
    })
    .then((client) => client.mutationEpoch);

const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

const riskCandidate = (
  proposedValue = "High Growth",
  evidence = `Evidence for ${proposedValue}`
): ExtractedCandidateProjection => ({
  field: "RISK_PROFILE",
  proposedValue,
  evidence,
  applicationStatus: "REQUIRES_ADVISER_APPROVAL",
  sourceRecordId: "source-meeting-note",
  observedDate: "2026-06-04"
});

const addressCandidate = (
  proposedValue = "Joondalup"
): ExtractedCandidateProjection => ({
  field: "ADDRESS",
  proposedValue,
  evidence: `Evidence for ${proposedValue}`,
  applicationStatus: "NEEDS_CONFIRMATION",
  sourceRecordId: "source-meeting-note",
  observedDate: "2026-06-04"
});

const createObservedSourceRecord = (id: string, observedAt: string) =>
  primary.sourceRecord.create({
    data: {
      id,
      clientId: DEMO_CLIENT_ID,
      type: SourceRecordType.ADVISER_MEETING_NOTE,
      title: `Adviser Meeting Note ${id}`,
      observedAt: new Date(`${observedAt}T00:00:00.000Z`),
      summary: "Integration test source record.",
      content: [`Observed ${observedAt}`],
      lifecycleStatus: LifecycleStatus.CURRENT
    }
  });

const preparationSteps = [
  {
    label: "Skill selected: prepare-annual-review",
    status: WorkflowStepStatus.COMPLETE
  },
  {
    label: "Skill completed: prepare-annual-review",
    status: WorkflowStepStatus.COMPLETE
  }
] as const;

const commitPreparation = async (
  service: ReturnType<typeof createReviewService>,
  expectedMutationEpoch: number,
  candidates: readonly ExtractedCandidateProjection[]
) =>
  service.commitPreparedReview({
    clientId: DEMO_CLIENT_ID,
    expectedMutationEpoch,
    skillName: "prepare-annual-review",
    skillVersion: "1",
    candidates,
    workflowSteps: preparationSteps
  });

const createUploadedSourceInput = (
  expectedMutationEpoch: number,
  safeFilename: string,
  text: string
) =>
  ({
    documentType: "TEXT",
    clientId: DEMO_CLIENT_ID,
    expectedMutationEpoch,
    observedDate: "2026-06-20",
    sourceType: "ADVISER_MEETING_NOTE",
    safeFilename,
    mediaType: "text/plain",
    text,
    characterCount: text.length,
    byteCount: Buffer.byteLength(text),
    originalByteCount: Buffer.byteLength(text)
  }) as const;

describe.sequential("PostgreSQL Batch 1 mutation guarantees", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    await resetCanonicalData();
  });

  afterAll(async () => {
    vi.useRealTimers();
    await Promise.all([primary.$disconnect(), secondary.$disconnect()]);
  });

  it("persists two uploaded source records with distinct IDs when time is frozen", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-30T12:00:00.000Z"));
    const coordinator = new ClientOperationCoordinator();
    const service = createReviewService(
      primary,
      coordinator
    );
    const expectedMutationEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    const [first, second] = await coordinator.runClientMutation(
      DEMO_CLIENT_ID,
      () =>
        Promise.all([
          service.createUploadedSourceRecord(
            createUploadedSourceInput(
              expectedMutationEpoch,
              "first-note.txt",
              "First uploaded note."
            )
          ),
          service.createUploadedSourceRecord(
            createUploadedSourceInput(
              expectedMutationEpoch,
              "second-note.txt",
              "Second uploaded note."
            )
          )
        ])
    );

    expect(first.sourceRecord.id).toMatch(
      /^source-upload-demo-alex-taylor-[0-9a-f-]{36}$/
    );
    expect(second.sourceRecord.id).toMatch(
      /^source-upload-demo-alex-taylor-[0-9a-f-]{36}$/
    );
    expect(first.sourceRecord.id).not.toBe(second.sourceRecord.id);
    expect(first.sourceRecord.upload.uploadedAt).toBe(
      "2026-06-30T12:00:00.000Z"
    );
    expect(second.sourceRecord.upload.uploadedAt).toBe(
      "2026-06-30T12:00:00.000Z"
    );
    await expect(
      primary.sourceRecord.findMany({
        where: { id: { in: [first.sourceRecord.id, second.sourceRecord.id] } },
        orderBy: { title: "asc" },
        select: { id: true, title: true, content: true }
      })
    ).resolves.toMatchObject([
      {
        id: first.sourceRecord.id,
        title: "Uploaded: first-note.txt",
        content: {
          lines: ["First uploaded note."]
        }
      },
      {
        id: second.sourceRecord.id,
        title: "Uploaded: second-note.txt",
        content: {
          lines: ["Second uploaded note."]
        }
      }
    ]);
  });

  it("persists distinct adviser decision and workflow audit IDs when time is frozen", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-30T12:00:00.000Z"));
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator()
    );

    await service.recordDecision(DEMO_CLIENT_ID, "fact-risk-profile", {
      decision: DecisionType.APPROVE
    });
    await service.recordDecision(DEMO_CLIENT_ID, "fact-address", {
      decision: DecisionType.CONFIRM
    });

    const decisions = await primary.adviserDecision.findMany({
      where: {
        clientId: DEMO_CLIENT_ID,
        factId: { in: ["fact-risk-profile", "fact-address"] }
      },
      orderBy: { factId: "asc" },
      select: { id: true, factId: true, decisionType: true }
    });
    const workflowRuns = await primary.workflowRun.findMany({
      where: {
        clientId: DEMO_CLIENT_ID,
        id: {
          startsWith: `workflow-${DEMO_CLIENT_ID}-apply-adviser-decision-v1-`
        }
      },
      orderBy: { id: "asc" },
      select: { id: true, steps: { select: { id: true } } }
    });

    expect(decisions).toHaveLength(2);
    expect(new Set(decisions.map((decision) => decision.id)).size).toBe(2);
    expect(decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(
            /^decision-fact-address-CONFIRM-[0-9a-f-]{36}$/
          ),
          factId: "fact-address",
          decisionType: DecisionType.CONFIRM
        }),
        expect.objectContaining({
          id: expect.stringMatching(
            /^decision-fact-risk-profile-APPROVE-[0-9a-f-]{36}$/
          ),
          factId: "fact-risk-profile",
          decisionType: DecisionType.APPROVE
        })
      ])
    );
    expect(workflowRuns).toHaveLength(2);
    expect(new Set(workflowRuns.map((run) => run.id)).size).toBe(2);
    expect(workflowRuns.every((run) => run.steps.length === 6)).toBe(true);
    expect(await factState("fact-risk-profile")).toMatchObject({
      officialValue: "Growth-oriented",
      candidateValue: null,
      lifecycleStatus: LifecycleStatus.CURRENT,
      revision: 1
    });
    expect(await factState("fact-address")).toMatchObject({
      officialValue: "Subiaco",
      candidateValue: null,
      lifecycleStatus: LifecycleStatus.CURRENT,
      revision: 1
    });
  });

  it.each([
    [
      "fact-risk-profile",
      DecisionType.APPROVE,
      DecisionType.KEEP_CURRENT
    ],
    [
      "fact-address",
      DecisionType.CONFIRM,
      DecisionType.LEAVE_UNVERIFIED
    ]
  ] as const)(
    "allows exactly one deterministic conflicting transition for %s",
    async (factId, firstDecision, secondDecision) => {
      const bothFactsRead = deferred();
      const releaseDecisions = deferred();
      let readCount = 0;
      const afterDecisionFactRead = async () => {
        readCount += 1;
        if (readCount === 2) {
          bothFactsRead.resolve();
        }
        await releaseDecisions.promise;
      };
      const firstService = createReviewService(
        primary,
        new ClientOperationCoordinator(),
        { afterDecisionFactRead }
      );
      const secondService = createReviewService(
        secondary,
        new ClientOperationCoordinator(),
        { afterDecisionFactRead }
      );

      const first = firstService.recordDecision(DEMO_CLIENT_ID, factId, {
        decision: firstDecision
      });
      const second = secondService.recordDecision(DEMO_CLIENT_ID, factId, {
        decision: secondDecision
      });
      await bothFactsRead.promise;
      releaseDecisions.resolve();
      const results = await Promise.allSettled([first, second]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.find((result) => result.status === "rejected")).toMatchObject({
        status: "rejected",
        reason: expect.any(DecisionConflictError)
      });
      expect(
        await primary.adviserDecision.count({ where: { factId } })
      ).toBe(1);
      expect(
        await primary.workflowRun.count({ where: { clientId: DEMO_CLIENT_ID } })
      ).toBe(2);
      expect(
        await primary.workflowStep.count({
          where: {
            workflowRun: {
              clientId: DEMO_CLIENT_ID
            }
          }
        })
      ).toBe(14);

      const fact = await factState(factId);
      expect(fact.candidateValue).toBeNull();
      expect(fact.lifecycleStatus).toBe(LifecycleStatus.CURRENT);
      expect(fact.revision).toBe(1);
    }
  );

  it("allows exactly one of two duplicate APPROVE requests", async () => {
    const bothFactsRead = deferred();
    const releaseDecisions = deferred();
    let readCount = 0;
    const afterDecisionFactRead = async () => {
      readCount += 1;
      if (readCount === 2) {
        bothFactsRead.resolve();
      }
      await releaseDecisions.promise;
    };
    const firstService = createReviewService(
      primary,
      new ClientOperationCoordinator(),
      { afterDecisionFactRead }
    );
    const secondService = createReviewService(
      secondary,
      new ClientOperationCoordinator(),
      { afterDecisionFactRead }
    );

    const first = firstService.recordDecision(
      DEMO_CLIENT_ID,
      "fact-risk-profile",
      { decision: DecisionType.APPROVE }
    );
    const second = secondService.recordDecision(
      DEMO_CLIENT_ID,
      "fact-risk-profile",
      { decision: DecisionType.APPROVE }
    );
    await bothFactsRead.promise;
    releaseDecisions.resolve();
    const results = await Promise.allSettled([first, second]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      status: "rejected",
      reason: expect.any(DecisionConflictError)
    });
    expect(await factState("fact-risk-profile")).toMatchObject({
      officialValue: "Growth-oriented",
      previousValue: "Balanced",
      candidateValue: null,
      lifecycleStatus: LifecycleStatus.CURRENT,
      revision: 1
    });
  });

  it("rejects a stale cross-process-style decision after reset changes the epoch", async () => {
    const factRead = deferred();
    const releaseDecision = deferred();
    const staleService = createReviewService(
      primary,
      new ClientOperationCoordinator(),
      {
        afterDecisionFactRead: async () => {
          factRead.resolve();
          await releaseDecision.promise;
        }
      }
    );
    const resetService = createReviewService(
      secondary,
      new ClientOperationCoordinator()
    );
    const epochBefore = await clientEpoch();

    const decision = staleService.recordDecision(
      DEMO_CLIENT_ID,
      "fact-risk-profile",
      { decision: DecisionType.APPROVE }
    );
    await factRead.promise;
    await resetService.resetDemo();
    expect(await clientEpoch()).toBe(epochBefore + 1);
    releaseDecision.resolve();

    await expect(decision).rejects.toBeInstanceOf(DecisionConflictError);
    expect(
      await primary.clientFact.count({ where: { clientId: DEMO_CLIENT_ID } })
    ).toBe(0);
    expect(
      await primary.adviserDecision.count({ where: { clientId: DEMO_CLIENT_ID } })
    ).toBe(0);
    expect(
      await primary.workflowRun.count({ where: { clientId: DEMO_CLIENT_ID } })
    ).toBe(0);
  });

  it("preserves a newer adviser decision when preparation resumes", async () => {
    const preparationPaused = deferred();
    const releasePreparation = deferred();
    const preparationService = createReviewService(
      primary,
      new ClientOperationCoordinator(),
      {
        beforePreparationCommit: async () => {
          preparationPaused.resolve();
          await releasePreparation.promise;
        }
      }
    );
    const decisionService = createReviewService(
      secondary,
      new ClientOperationCoordinator()
    );
    const expectedMutationEpoch =
      await preparationService.captureClientMutationEpoch(DEMO_CLIENT_ID);
    const preparation = commitPreparation(
      preparationService,
      expectedMutationEpoch,
      [riskCandidate()]
    );
    await preparationPaused.promise;
    await decisionService.recordDecision(
      DEMO_CLIENT_ID,
      "fact-risk-profile",
      { decision: DecisionType.APPROVE }
    );
    releasePreparation.resolve();
    await preparation;

    expect(await factState("fact-risk-profile")).toMatchObject({
      officialValue: "Growth-oriented",
      previousValue: "Balanced",
      candidateValue: null,
      lifecycleStatus: LifecycleStatus.CURRENT,
      revision: 1
    });
    expect(
      await primary.adviserDecision.count({
        where: { factId: "fact-risk-profile" }
      })
    ).toBe(1);
  });

  it("keeps the decision revision stable for identical preparation", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator()
    );
    const expectedMutationEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await commitPreparation(service, expectedMutationEpoch, [
      riskCandidate(
        "Growth-oriented",
        "Alex is considering a more growth-oriented investment approach."
      )
    ]);
    const firstRevision = (await factState("fact-risk-profile")).revision;
    await commitPreparation(service, expectedMutationEpoch, [
      riskCandidate(
        "Growth-oriented",
        "Alex is considering a more growth-oriented investment approach."
      )
    ]);

    expect(firstRevision).toBe(0);
    expect((await factState("fact-risk-profile")).revision).toBe(firstRevision);
    expect(
      await primary.workflowRun.count({ where: { clientId: DEMO_CLIENT_ID } })
    ).toBe(3);
  });

  it("increments revision for a genuinely new candidate and for a decision", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator()
    );
    const expectedMutationEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await commitPreparation(service, expectedMutationEpoch, [
      riskCandidate("High Growth")
    ]);
    expect((await factState("fact-risk-profile")).revision).toBe(1);

    const result = await service.recordDecision(DEMO_CLIENT_ID, "fact-risk-profile", {
      decision: DecisionType.APPROVE
    });
    expect(result.refreshRequired).toBe(false);
    expect(result.review?.client.id).toBe(DEMO_CLIENT_ID);
    expect((await factState("fact-risk-profile")).revision).toBe(2);
  });

  it("rolls back workflow and projection when atomic preparation commit fails", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator(),
      {
        afterPreparationWorkflowRunWrite: async () => {
          throw new Error("forced preparation commit failure");
        }
      }
    );
    const expectedMutationEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await expect(
      commitPreparation(service, expectedMutationEpoch, [
        riskCandidate("High Growth")
      ])
    ).rejects.toThrow("forced preparation commit failure");
    expect(await factState("fact-risk-profile")).toMatchObject({
      candidateValue: "Growth-oriented",
      revision: 0
    });
    expect(
      await primary.workflowRun.count({ where: { clientId: DEMO_CLIENT_ID } })
    ).toBe(1);
    expect(
      await primary.workflowStep.count({
        where: { workflowRunId: "workflow-seeded-alex-2026" }
      })
    ).toBe(8);
  });

  it("rejects preparation captured before a reset", async () => {
    const staleService = createReviewService(
      primary,
      new ClientOperationCoordinator()
    );
    const resetService = createReviewService(
      secondary,
      new ClientOperationCoordinator()
    );
    const staleEpoch =
      await staleService.captureClientMutationEpoch(DEMO_CLIENT_ID);
    await resetService.resetDemo();

    await expect(
      commitPreparation(staleService, staleEpoch, [riskCandidate()])
    ).rejects.toBeInstanceOf(ClientMutationConflictError);
  });

  it("keeps official provenance stable when preparation extracts no candidates", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator()
    );
    const expectedMutationEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await commitPreparation(service, expectedMutationEpoch, []);

    expect(await factState("fact-address")).toMatchObject({
      officialValue: "East Perth",
      officialSourceRecordId: "source-annual-review",
      officialObservedAt: new Date("2025-11-16T00:00:00.000Z"),
      candidateValue: null,
      candidateSourceRecordId: null,
      candidateObservedAt: null
    });
    expect(await factState("fact-risk-profile")).toMatchObject({
      officialValue: "Balanced",
      officialSourceRecordId: "source-annual-review",
      officialObservedAt: new Date("2025-11-16T00:00:00.000Z"),
      candidateValue: null,
      candidateSourceRecordId: null,
      candidateObservedAt: null
    });
  });

  it("stores candidate provenance separately while official provenance remains stable", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator()
    );
    const expectedMutationEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await commitPreparation(service, expectedMutationEpoch, [
      addressCandidate("Fremantle"),
      riskCandidate("High Growth")
    ]);

    expect(await factState("fact-address")).toMatchObject({
      officialValue: "East Perth",
      officialSourceRecordId: "source-annual-review",
      officialObservedAt: new Date("2025-11-16T00:00:00.000Z"),
      candidateValue: "Fremantle",
      candidateSourceRecordId: "source-meeting-note",
      candidateObservedAt: new Date("2026-06-04T00:00:00.000Z"),
      candidateEvidence: "Evidence for Fremantle"
    });
    expect(await factState("fact-risk-profile")).toMatchObject({
      officialValue: "Balanced",
      officialSourceRecordId: "source-annual-review",
      officialObservedAt: new Date("2025-11-16T00:00:00.000Z"),
      candidateValue: "High Growth",
      candidateSourceRecordId: "source-meeting-note",
      candidateObservedAt: new Date("2026-06-04T00:00:00.000Z"),
      candidateEvidence: "Evidence for High Growth"
    });
  });

  it("moves candidate provenance to official provenance on approval", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator()
    );
    const expectedMutationEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await commitPreparation(service, expectedMutationEpoch, [
      riskCandidate("High Growth")
    ]);
    await service.recordDecision(DEMO_CLIENT_ID, "fact-risk-profile", {
      decision: DecisionType.APPROVE
    });

    expect(await factState("fact-risk-profile")).toMatchObject({
      officialValue: "High Growth",
      officialSourceRecordId: "source-meeting-note",
      officialObservedAt: new Date("2026-06-04T00:00:00.000Z"),
      previousValue: "Balanced",
      previousSourceRecordId: "source-annual-review",
      previousObservedAt: new Date("2025-11-16T00:00:00.000Z"),
      candidateValue: null,
      candidateSourceRecordId: null,
      candidateObservedAt: null,
      candidateEvidence: null
    });
    expect(await latestDecision("fact-risk-profile")).toMatchObject({
      decisionType: DecisionType.APPROVE,
      actor: "demo-adviser",
      candidateValue: "High Growth",
      candidateSourceRecordId: "source-meeting-note",
      candidateObservedAt: new Date("2026-06-04T00:00:00.000Z"),
      candidateEvidence: "Evidence for High Growth",
      officialValueBefore: "Balanced",
      officialSourceRecordIdBefore: "source-annual-review",
      officialObservedAtBefore: new Date("2025-11-16T00:00:00.000Z"),
      resultingOfficialValue: "High Growth",
      resultingOfficialSourceRecordId: "source-meeting-note",
      resultingOfficialObservedAt: new Date("2026-06-04T00:00:00.000Z")
    });
  });

  it("returns committed refresh-required when post-commit decision readback fails", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator(),
      {
        beforeDecisionResponseRead: async () => {
          throw new Error("forced response read failure");
        }
      }
    );

    const result = await service.recordDecision(
      DEMO_CLIENT_ID,
      "fact-risk-profile",
      { decision: DecisionType.APPROVE }
    );

    expect(result).toEqual({
      committed: true,
      refreshRequired: true,
      review: null,
      message: "Decision was saved. Refresh to load the latest review."
    });
    expect(await factState("fact-risk-profile")).toMatchObject({
      officialValue: "Growth-oriented",
      previousValue: "Balanced",
      candidateValue: null,
      lifecycleStatus: LifecycleStatus.CURRENT,
      revision: 1
    });
    expect(await latestDecision("fact-risk-profile")).toMatchObject({
      decisionType: DecisionType.APPROVE,
      candidateValue: "Growth-oriented",
      candidateEvidence:
        "Alex is considering a more growth-oriented investment approach.",
      resultingOfficialValue: "Growth-oriented"
    });
    expect(
      await primary.workflowRun.count({ where: { clientId: DEMO_CLIENT_ID } })
    ).toBe(2);
    expect(
      await primary.workflowStep.count({
        where: {
          workflowRun: {
            clientId: DEMO_CLIENT_ID
          }
        }
      })
    ).toBe(14);
  });

  it("preserves KEEP_CURRENT candidate evidence in the decision snapshot after clearing active state", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator()
    );

    await service.recordDecision(DEMO_CLIENT_ID, "fact-risk-profile", {
      decision: DecisionType.KEEP_CURRENT
    });

    expect(await factState("fact-risk-profile")).toMatchObject({
      officialValue: "Balanced",
      candidateValue: null,
      candidateSourceRecordId: null,
      candidateObservedAt: null,
      candidateEvidence: null
    });
    expect(await latestDecision("fact-risk-profile")).toMatchObject({
      decisionType: DecisionType.KEEP_CURRENT,
      actor: "demo-adviser",
      candidateValue: "Growth-oriented",
      candidateSourceRecordId: "source-meeting-note",
      candidateObservedAt: new Date("2026-06-04T00:00:00.000Z"),
      candidateEvidence:
        "Alex is considering a more growth-oriented investment approach.",
      officialValueBefore: "Balanced",
      officialSourceRecordIdBefore: "source-annual-review",
      officialObservedAtBefore: new Date("2025-11-16T00:00:00.000Z"),
      resultingOfficialValue: "Balanced",
      resultingOfficialSourceRecordId: "source-annual-review",
      resultingOfficialObservedAt: new Date("2025-11-16T00:00:00.000Z")
    });
  });

  it("preserves LEAVE_UNVERIFIED candidate evidence in the decision snapshot after clearing active state", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator()
    );

    await service.recordDecision(DEMO_CLIENT_ID, "fact-address", {
      decision: DecisionType.LEAVE_UNVERIFIED
    });

    expect(await factState("fact-address")).toMatchObject({
      officialValue: "East Perth",
      candidateValue: null,
      candidateSourceRecordId: null,
      candidateObservedAt: null,
      candidateEvidence: null
    });
    expect(await latestDecision("fact-address")).toMatchObject({
      decisionType: DecisionType.LEAVE_UNVERIFIED,
      actor: "demo-adviser",
      candidateValue: "Subiaco",
      candidateSourceRecordId: "source-meeting-note",
      candidateObservedAt: new Date("2026-06-04T00:00:00.000Z"),
      candidateEvidence:
        "Alex may have moved to Subiaco, but the address has not been confirmed.",
      officialValueBefore: "East Perth",
      resultingOfficialValue: "East Perth"
    });
  });

  it("projects a candidate from a newer source even after a recent approval decision", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator()
    );
    const initialEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await commitPreparation(service, initialEpoch, [
      riskCandidate("High Growth")
    ]);
    await service.recordDecision(DEMO_CLIENT_ID, "fact-risk-profile", {
      decision: DecisionType.APPROVE
    });
    await createObservedSourceRecord("source-newer-note", "2026-06-20");
    const postApprovalEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await commitPreparation(service, postApprovalEpoch, [
      {
        ...riskCandidate("Conservative"),
        sourceRecordId: "source-newer-note",
        observedDate: "2026-06-20"
      }
    ]);

    expect(await factState("fact-risk-profile")).toMatchObject({
      officialValue: "High Growth",
      officialSourceRecordId: "source-meeting-note",
      officialObservedAt: new Date("2026-06-04T00:00:00.000Z"),
      candidateValue: "Conservative",
      candidateSourceRecordId: "source-newer-note",
      candidateObservedAt: new Date("2026-06-20T00:00:00.000Z")
    });
  });

  it("does not project a candidate from an older source than the current official provenance", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator()
    );
    const initialEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await commitPreparation(service, initialEpoch, [
      riskCandidate("High Growth")
    ]);
    await service.recordDecision(DEMO_CLIENT_ID, "fact-risk-profile", {
      decision: DecisionType.APPROVE
    });
    const postApprovalEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await commitPreparation(service, postApprovalEpoch, [
      {
        ...riskCandidate("Conservative"),
        sourceRecordId: "source-annual-review",
        observedDate: "2025-11-16"
      }
    ]);

    expect(await factState("fact-risk-profile")).toMatchObject({
      officialValue: "High Growth",
      officialSourceRecordId: "source-meeting-note",
      officialObservedAt: new Date("2026-06-04T00:00:00.000Z"),
      candidateValue: null,
      candidateSourceRecordId: null,
      candidateObservedAt: null
    });
  });

  it("does not project a conflicting candidate from the same source date as official provenance", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator()
    );
    const initialEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await commitPreparation(service, initialEpoch, [
      riskCandidate("High Growth")
    ]);
    await service.recordDecision(DEMO_CLIENT_ID, "fact-risk-profile", {
      decision: DecisionType.APPROVE
    });
    const postApprovalEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await commitPreparation(service, postApprovalEpoch, [
      riskCandidate("Conservative")
    ]);

    expect(await factState("fact-risk-profile")).toMatchObject({
      officialValue: "High Growth",
      officialSourceRecordId: "source-meeting-note",
      officialObservedAt: new Date("2026-06-04T00:00:00.000Z"),
      candidateValue: null,
      candidateSourceRecordId: null,
      candidateObservedAt: null
    });
  });

  it("restores deterministic seeded provenance on reset", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator()
    );
    const expectedMutationEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await commitPreparation(service, expectedMutationEpoch, [
      addressCandidate("Fremantle")
    ]);
    const resetReview = await service.resetDemo();

    expect(resetReview).toMatchObject({
      client: {
        id: DEMO_CLIENT_ID,
        reviewStatus: "Preparation in progress"
      },
      clientFacts: [],
      meaningfulChanges: [],
      adviserActions: [],
      workflowTrace: []
    });
    expect(resetReview.summaryMetrics).toEqual([
      { value: "6", label: "Facts reviewed" },
      { value: "0", label: "Meaningful changes" },
      { value: "0", label: "Items needing confirmation" }
    ]);
    expect(resetReview.sourceRecords.map((record) => record.id).sort()).toEqual([
      "source-annual-review",
      "source-legacy-crm",
      "source-meeting-note"
    ]);
    expect(
      await primary.clientFact.count({ where: { clientId: DEMO_CLIENT_ID } })
    ).toBe(0);
    expect(
      await primary.adviserDecision.count({ where: { clientId: DEMO_CLIENT_ID } })
    ).toBe(0);
    expect(
      await primary.workflowRun.count({ where: { clientId: DEMO_CLIENT_ID } })
    ).toBe(0);
  });

  it("removes prepared review data and uploaded sources while preserving seed sources on reset", async () => {
    const coordinator = new ClientOperationCoordinator();
    const service = createReviewService(
      primary,
      coordinator
    );
    const expectedMutationEpoch =
      await service.captureClientMutationEpoch(DEMO_CLIENT_ID);

    await coordinator.runClientMutation(DEMO_CLIENT_ID, () =>
      service.createUploadedSourceRecord(
        createUploadedSourceInput(
          expectedMutationEpoch,
          "reset-note.txt",
          "Uploaded source that should be removed by reset."
        )
      )
    );
    await service.recordDecision(DEMO_CLIENT_ID, "fact-address", {
      decision: DecisionType.LEAVE_UNVERIFIED
    });

    const resetReview = await service.resetDemo();

    expect(resetReview.clientFacts).toEqual([]);
    expect(resetReview.adviserActions).toEqual([]);
    expect(resetReview.meaningfulChanges).toEqual([]);
    expect(resetReview.workflowTrace).toEqual([]);
    expect(resetReview.sourceRecords.map((record) => record.id).sort()).toEqual([
      "source-annual-review",
      "source-legacy-crm",
      "source-meeting-note"
    ]);
    expect(
      resetReview.sourceRecords.some((record) => record.title.includes("Uploaded"))
    ).toBe(false);
  });

  it("rolls back the complete reset when the seed transaction fails", async () => {
    await primary.client.update({
      where: { id: DEMO_CLIENT_ID },
      data: { reviewStatus: "Pre-reset marker" }
    });
    const epochBefore = await clientEpoch();
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator(),
      {
        beforeResetCommit: async () => {
          throw new Error("forced reset failure");
        }
      }
    );

    await expect(service.resetDemo()).rejects.toThrow("forced reset failure");
    expect(
      await primary.client.findUniqueOrThrow({
        where: { id: DEMO_CLIENT_ID },
        select: { reviewStatus: true, mutationEpoch: true }
      })
    ).toEqual({
      reviewStatus: "Pre-reset marker",
      mutationEpoch: epochBefore
    });
    expect(
      await primary.clientFact.count({ where: { clientId: DEMO_CLIENT_ID } })
    ).toBe(6);
  });

  it("rolls back the fact transition when mandatory audit persistence fails", async () => {
    const service = createReviewService(
      primary,
      new ClientOperationCoordinator(),
      {
        beforeDecisionAuditWrite: async () => {
          throw new Error("forced audit failure");
        }
      }
    );

    await expect(
      service.recordDecision(DEMO_CLIENT_ID, "fact-risk-profile", {
        decision: DecisionType.APPROVE
      })
    ).rejects.toThrow("forced audit failure");
    expect(await factState("fact-risk-profile")).toMatchObject({
      officialValue: "Balanced",
      candidateValue: "Growth-oriented",
      lifecycleStatus: LifecycleStatus.REQUIRES_ADVISER_APPROVAL,
      revision: 0
    });
    expect(
      await primary.adviserDecision.count({
        where: { factId: "fact-risk-profile" }
      })
    ).toBe(0);
    expect(
      await primary.workflowRun.count({ where: { clientId: DEMO_CLIENT_ID } })
    ).toBe(1);
  });
});
