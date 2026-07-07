import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReviewResponse } from "@client-review-prep/shared";
import {
  ClientReviewWorkspace,
  getWorkspaceTabAfterSelection,
  persistedValueForWorkspaceTab,
  readInitialWorkspaceTab,
  WorkspaceTabs,
  workspaceTabFromPersistedValue,
  workspaceTabStorageKey,
  type ClientReviewWorkspaceProps
} from "./ClientReviewWorkspace.js";
import type { AdviserAction, ClientFact } from "../types/demo.js";

type InspectableProps = Record<string, unknown> & {
  children?: ReactNode;
};
type InspectableElement = ReactElement<InspectableProps>;

const createFact = (overrides: Partial<ClientFact> = {}): ClientFact => ({
  id: "fact-address",
  field: "Address",
  currentLabel: "Current official value",
  currentValue: "East Perth",
  officialValue: "East Perth",
  candidateValue: "Subiaco",
  previousValue: null,
  sourceRecordId: "source-annual-review",
  sourceDocument: "Annual Review",
  observedAt: "2025-11-16T00:00:00.000Z",
  observedDate: "16 November 2025",
  officialSourceRecordId: "source-annual-review",
  officialSourceDocument: "Annual Review",
  officialObservedAt: "2025-11-16T00:00:00.000Z",
  officialObservedDate: "16 November 2025",
  previousSourceRecordId: null,
  previousSourceDocument: null,
  previousObservedAt: null,
  previousObservedDate: null,
  candidateSourceRecordId: "source-meeting-note",
  candidateSourceDocument: "Adviser Meeting Note",
  candidateObservedAt: "2026-06-04T00:00:00.000Z",
  candidateObservedDate: "4 June 2026",
  candidateEvidence:
    "Alex may have moved to Subiaco, but the address has not been confirmed.",
  confidence: "Medium",
  lifecycleStatus: "NEEDS_CONFIRMATION",
  status: "Needs confirmation",
  memoryExplanation: "Address remains pending adviser confirmation.",
  ...overrides
});

const createAction = (
  overrides: Partial<AdviserAction> = {}
): AdviserAction => ({
  id: "confirm-address",
  factId: "fact-address",
  title: "Confirm whether Alex has moved to Subiaco",
  detail: "Meeting note mentions Subiaco, but the address has not been verified.",
  status: "Needs confirmation",
  lifecycleStatus: "NEEDS_CONFIRMATION",
  primaryDecision: "CONFIRM",
  secondaryDecision: "LEAVE_UNVERIFIED",
  primaryLabel: "Confirm",
  secondaryLabel: "Leave unverified",
  latestDecision: null,
  decisionHistory: [],
  ...overrides
});

const review: ReviewResponse = {
  client: {
    id: "demo-alex-taylor",
    name: "Alex Taylor",
    adviserName: "Jordan Lee",
    reviewYear: 2026,
    reviewStatus: "Ready for adviser review"
  },
  summaryMetrics: [
    { value: "8", label: "Facts reviewed" },
    { value: "2", label: "Items needing confirmation" }
  ],
  sourceRecords: [
    {
      id: "source-annual-review",
      type: "ANNUAL_REVIEW",
      title: "2025 Annual Review",
      observedAt: "2025-11-16T00:00:00.000Z",
      observedDate: "16 November 2025",
      summary: "Verified annual review record.",
      content: ["Annual review content"],
      lifecycleStatus: "CURRENT"
    }
  ],
  clientFacts: [
    createFact(),
    createFact({
      id: "fact-risk-profile",
      field: "Risk profile",
      currentLabel: "Official value",
      currentValue: "Balanced",
      officialValue: "Balanced",
      candidateValue: "High Growth",
      lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
      status: "Requires adviser approval",
      memoryExplanation: "Risk profile requires adviser approval."
    })
  ],
  meaningfulChanges: ["Annual income increased from AUD 110,000 to AUD 135,000"],
  adviserActions: [
    createAction(),
    createAction({
      id: "review-risk-profile",
      factId: "fact-risk-profile",
      title: "Review the possible change from Balanced to a growth-oriented risk approach",
      detail: "This is a high-impact attribute and needs adviser approval before use.",
      status: "Requires adviser approval",
      lifecycleStatus: "REQUIRES_ADVISER_APPROVAL",
      primaryDecision: "APPROVE",
      secondaryDecision: "KEEP_CURRENT",
      primaryLabel: "Approve",
      secondaryLabel: "Keep current"
    })
  ],
  workflowTrace: [
    {
      label: "Skill selected: prepare-annual-review",
      status: "COMPLETE",
      detail: null
    }
  ],
  executionMetadata: {
    skillName: "prepare-annual-review",
    skillVersion: "legacy",
    status: "SUCCEEDED"
  }
};

const createWorkspaceProps = (
  overrides: Partial<ClientReviewWorkspaceProps> = {}
): ClientReviewWorkspaceProps => ({
  apiBaseUrl: "http://localhost:3001",
  apiStatus: "connected",
  clientId: "demo-alex-taylor",
  currentSelectedFact: null,
  extractionLabel: "Extraction: Mock",
  extractionWarning: null,
  isLoading: false,
  isPrepared: true,
  isPreparing: false,
  isResetting: false,
  latestUploadTrace: null,
  loadError: null,
  noticeMessage: null,
  prepareButtonLabel: "Re-run Preparation",
  reviewData: review,
  reviewStatus: "Ready for adviser review",
  savingFactId: null,
  selectedFactAction: null,
  skillLabel: "Selected skill: prepare-annual-review",
  uploadPanelResetToken: 0,
  onCloseEvidence: vi.fn(),
  onDecision: vi.fn(),
  onPrepareReview: vi.fn(),
  onResetDemo: vi.fn(),
  onSelectFact: vi.fn(),
  onUploaded: vi.fn(),
  ...overrides
});

const reviewWithDecision = (): ReviewResponse => ({
  ...review,
  adviserActions: [
    {
      ...review.adviserActions[0]!,
      latestDecision: {
        decision: "CONFIRM",
        note: "Confirmed with client.",
        candidateValue: "Subiaco",
        officialValueBefore: "East Perth",
        resultingOfficialValue: "Subiaco",
        actor: "demo-adviser",
        createdAt: "2026-06-24T00:00:00.000Z"
      },
      decisionHistory: [
        {
          decision: "CONFIRM",
          note: "Confirmed with client.",
          candidateValue: "Subiaco",
          officialValueBefore: "East Perth",
          resultingOfficialValue: "Subiaco",
          actor: "demo-adviser",
          createdAt: "2026-06-24T00:00:00.000Z"
        }
      ]
    },
    review.adviserActions[1]!
  ]
});

const renderWorkspace = (props: Partial<ClientReviewWorkspaceProps> = {}) =>
  renderToStaticMarkup(<ClientReviewWorkspace {...createWorkspaceProps(props)} />);

const findElement = (
  node: ReactNode,
  predicate: (element: InspectableElement) => boolean
): InspectableElement | null => {
  if (!isValidElement<InspectableProps>(node)) {
    return null;
  }

  if (predicate(node)) {
    return node;
  }

  for (const child of Children.toArray(node.props.children)) {
    const match = findElement(child, predicate);
    if (match) {
      return match;
    }
  }

  return null;
};

const textContent = (node: ReactNode): string =>
  Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (isValidElement<{ children?: ReactNode }>(child)) {
        return textContent(child.props.children);
      }

      return "";
    })
    .join("");

describe("ClientReviewWorkspace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the existing prepared review sections", () => {
    const markup = renderWorkspace();

    expect(markup).toContain("Alex Taylor");
    expect(markup).toContain("2026 Client Review");
    expect(markup).toContain("Adviser: Jordan Lee");
    expect(markup).toContain("2 open actions");
    expect(markup).toContain("Review");
    expect(markup).toContain("Evidence &amp; Sources");
    expect(markup).toContain("Decision History");
    expect(markup).toContain("Client Summary");
    expect(markup).toContain("Facts reviewed");
    expect(markup).toContain("Current client picture");
    expect(markup).toContain("Meaningful changes");
    expect(markup).toContain("Adviser actions");
    expect(markup).not.toContain("Upload source note");
    expect(markup).not.toContain("Source records");
    expect(markup).toContain("Technical details");
    expect(markup).toContain("Demo controls");
  });

  it("renders accessible workspace tabs and wires tab switching callbacks", () => {
    const onChange = vi.fn();
    const tree = (
      <WorkspaceTabs activeTab="review" onChange={onChange} tabPrefix="client" />
    );
    const markup = renderToStaticMarkup(tree);
    const tabTree = WorkspaceTabs({
      activeTab: "review",
      onChange,
      tabPrefix: "client"
    });
    const evidenceTab = findElement(
      tabTree,
      (element) =>
        element.type === "button" &&
        textContent(element.props.children) === "Evidence & Sources"
    );

    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('role="tab"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('aria-controls="client-review"');

    (evidenceTab?.props.onClick as () => void)();

    expect(onChange).toHaveBeenCalledWith("evidence");
  });

  it("restores Client Summary from session storage on refresh", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: vi.fn(() => "client-summary"),
        setItem: vi.fn()
      }
    });

    const markup = renderWorkspace();

    expect(readInitialWorkspaceTab()).toBe("summary");
    expect(markup).toContain("Review preparation summary");
    expect(markup).toContain("Current client picture");
    expect(markup).not.toContain("Adviser actions");
  });

  it("keeps Client Summary selected through the refresh loading-to-prepared sequence", () => {
    const storedValueBeforeMount = "client-summary";

    expect(readInitialWorkspaceTab("summary")).toBe("summary");
    expect(
      getWorkspaceTabAfterSelection({
        activeTab: workspaceTabFromPersistedValue(storedValueBeforeMount),
        currentSelectedFact: null,
        hasReviewData: false,
        isPrepared: false
      })
    ).toBe("summary");
    expect(
      getWorkspaceTabAfterSelection({
        activeTab: "summary",
        currentSelectedFact: null,
        hasReviewData: true,
        isPrepared: true
      })
    ).toBe("summary");
  });

  it.each([
    ["review", "review"],
    ["evidence-sources", "evidence"],
    ["decision-history", "history"],
    ["client-summary", "summary"]
  ] as const)("restores stored workspace tab %s", (storedValue, tab) => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: vi.fn(() => storedValue),
        setItem: vi.fn()
      }
    });

    expect(readInitialWorkspaceTab()).toBe(tab);
    expect(workspaceTabFromPersistedValue(storedValue)).toBe(tab);
    expect(persistedValueForWorkspaceTab(tab)).toBe(storedValue);
  });

  it("falls back to Review for an invalid stored workspace tab", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: vi.fn(() => "not-a-workspace-tab"),
        setItem: vi.fn()
      }
    });

    const markup = renderWorkspace();

    expect(readInitialWorkspaceTab()).toBe("review");
    expect(markup).toContain("Adviser actions");
    expect(markup).not.toContain("Review preparation summary");
  });

  it("shows source features only in Evidence & Sources", () => {
    const reviewMarkup = renderWorkspace();
    const evidenceMarkup = renderWorkspace({ initialTab: "evidence" });

    expect(reviewMarkup).not.toContain("Upload source note");
    expect(reviewMarkup).not.toContain("Source records");
    expect(evidenceMarkup).toContain("Upload source note");
    expect(evidenceMarkup).toContain("Source records");
    expect(evidenceMarkup).toContain("2025 Annual Review");
  });

  it("keeps technical and demo-only content out of the primary workspace by default", () => {
    const markup = renderWorkspace({
      extractionLabel: "Extraction: Mock",
      latestUploadTrace: {
        skillName: "ingest-client-document",
        skillVersion: "legacy",
        status: "SUCCEEDED",
        events: [
          {
            sequence: 1,
            label: "Upload request validated",
            status: "COMPLETE",
            detail: null,
            timestamp: "2026-06-24T00:00:00.000Z"
          }
        ]
      }
    });

    expect(markup).not.toContain("API connected");
    expect(markup).not.toContain("Extraction: Mock");
    expect(markup).not.toContain("Selected skill: prepare-annual-review");
    expect(markup).not.toContain("View execution trace");
    expect(markup).not.toContain("View upload execution trace");
    expect(markup).not.toContain("Upload request validated");
    expect(markup).not.toContain("Reset local demo data");
  });

  it("preserves the existing pre-preparation workspace state", () => {
    const markup = renderWorkspace({
      isPrepared: false,
      prepareButtonLabel: "Prepare Client Review",
      reviewData: {
        ...review,
        client: {
          ...review.client,
          reviewStatus: "Preparation in progress"
        }
      }
    });

    expect(markup).toContain("Ready to prepare");
    expect(markup).toContain("Adviser workspace will appear here");
    expect(markup).toContain("Prepare Client Review");
    expect(markup).toContain("Source material is available for this review.");
    expect(markup).not.toContain("Current client picture");
    expect(markup).not.toContain("fictional");
    expect(markup).not.toContain("does not call AI");
    expect(markup).not.toContain("production CRM");
  });

  it("renders selected fact evidence without changing the drawer behaviour", () => {
    const markup = renderWorkspace({
      currentSelectedFact: review.clientFacts[0] ?? null,
      selectedFactAction: review.adviserActions[0] ?? null
    });

    expect(markup).toContain("Evidence and memory");
    expect(markup).toContain("Candidate evidence");
    expect(markup).toContain("Close");
  });

  it("keeps source upload and source records in the Evidence & Sources workspace", () => {
    const markup = renderWorkspace({
      initialTab: "evidence",
      latestUploadTrace: {
        skillName: "ingest-client-document",
        skillVersion: "legacy",
        status: "SUCCEEDED",
        events: [
          {
            sequence: 1,
            label: "Upload request validated",
            status: "COMPLETE",
            detail: null,
            timestamp: "2026-06-24T00:00:00.000Z"
          }
        ]
      }
    });

    expect(markup).toContain("Upload source note");
    expect(markup).toContain("Source records");
    expect(markup).toContain("2025 Annual Review");
    expect(markup).not.toContain("Upload request validated");
  });

  it("forces direct selected-fact navigation and reset states back to the Review tab", () => {
    expect(workspaceTabStorageKey).toBe(
      "adviser-review-copilot.client-review.workspace-tab"
    );
    expect(
      getWorkspaceTabAfterSelection({
        activeTab: workspaceTabFromPersistedValue("client-summary"),
        currentSelectedFact: review.clientFacts[0] ?? null,
        hasReviewData: true,
        isPrepared: true
      })
    ).toBe("review");
    expect(
      getWorkspaceTabAfterSelection({
        activeTab: workspaceTabFromPersistedValue("decision-history"),
        currentSelectedFact: null,
        hasReviewData: true,
        isPrepared: false
      })
    ).toBe("review");
    expect(
      getWorkspaceTabAfterSelection({
        activeTab: "history",
        currentSelectedFact: null,
        isPrepared: true
      })
    ).toBe("history");
  });

  it("renders persisted decision history newest first with recorded values", () => {
    const markup = renderWorkspace({
      initialTab: "history",
      reviewData: reviewWithDecision()
    });

    expect(markup).toContain("Decision history");
    expect(markup).toContain("Persisted adviser decisions for this review.");
    expect(markup).toContain("Address");
    expect(markup).toContain("CONFIRM");
    expect(markup).toContain("demo-adviser");
    expect(markup).toContain("East Perth");
    expect(markup).toContain("Subiaco");
  });

  it("renders an honest empty state when decision history is empty", () => {
    const markup = renderWorkspace({ initialTab: "history" });

    expect(markup).toContain(
      "No adviser decisions have been recorded for this review yet."
    );
  });

  it("renders the selector-driven client preparation summary", () => {
    const markup = renderWorkspace({
      initialTab: "summary",
      reviewData: reviewWithDecision()
    });

    expect(markup).toContain("Review preparation summary");
    expect(markup).toContain("This is not financial advice.");
    expect(markup).toContain("Current client picture");
    expect(markup).toContain("Confirmed changes");
    expect(markup).toContain("Outstanding questions");
    expect(markup).toContain("Adviser decisions");
    expect(markup).toContain("Subiaco");
  });
});
