import {
  DecisionType,
  LifecycleStatus,
  PrismaClient,
  WorkflowStepStatus
} from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
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
  proposedValue = "High Growth"
): ExtractedCandidateProjection => ({
  field: "RISK_PROFILE",
  proposedValue,
  evidence: `Evidence for ${proposedValue}`,
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

describe.sequential("PostgreSQL Batch 1 mutation guarantees", () => {
  beforeEach(async () => {
    await resetCanonicalData();
  });

  afterAll(async () => {
    await Promise.all([primary.$disconnect(), secondary.$disconnect()]);
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
    expect(await factState("fact-risk-profile")).toMatchObject({
      officialValue: "Balanced",
      candidateValue: "Growth-oriented",
      previousValue: null,
      lifecycleStatus: LifecycleStatus.REQUIRES_ADVISER_APPROVAL,
      revision: 0
    });
    expect(
      await primary.adviserDecision.count({ where: { clientId: DEMO_CLIENT_ID } })
    ).toBe(0);
    expect(
      await primary.workflowRun.count({ where: { clientId: DEMO_CLIENT_ID } })
    ).toBe(1);
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
      riskCandidate("Growth-oriented")
    ]);
    const firstRevision = (await factState("fact-risk-profile")).revision;
    await commitPreparation(service, expectedMutationEpoch, [
      riskCandidate("Growth-oriented")
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

    await service.recordDecision(DEMO_CLIENT_ID, "fact-risk-profile", {
      decision: DecisionType.APPROVE
    });
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
    await service.resetDemo();

    expect(await factState("fact-address")).toMatchObject({
      officialValue: "East Perth",
      officialSourceRecordId: "source-annual-review",
      officialObservedAt: new Date("2025-11-16T00:00:00.000Z"),
      candidateValue: "Subiaco",
      candidateSourceRecordId: "source-meeting-note",
      candidateObservedAt: new Date("2026-06-04T00:00:00.000Z")
    });
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
