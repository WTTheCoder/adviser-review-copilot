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
  initialLoadingIndicatorDelayMs,
  nextWorkspaceTabFromKey,
  persistedValueForWorkspaceTab,
  readInitialWorkspaceTab,
  scheduleInitialLoadingIndicator,
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
    adviserName: "Jordan Bennett",
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

const findElements = (
  node: ReactNode,
  predicate: (element: InspectableElement) => boolean
): InspectableElement[] => {
  if (!isValidElement<InspectableProps>(node)) {
    return [];
  }

  const matches = predicate(node) ? [node] : [];

  return [
    ...matches,
    ...Children.toArray(node.props.children).flatMap((child) =>
      findElements(child, predicate)
    )
  ];
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the existing prepared review sections", () => {
    const markup = renderWorkspace();

    expect(markup).toContain("Alex Taylor");
    expect(markup).toContain("2026 Client Review");
    expect(markup).toContain("Adviser: Jordan Bennett");
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
    expect(markup).toContain("mt-5 grid items-start gap-4 lg:grid-cols-2");
  });

  it("renders complete accessible workspace tab semantics", () => {
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
    expect(markup).toContain('aria-controls="client-review-panel"');
    expect(markup).toContain('id="client-review-tab"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('tabindex="-1"');

    (evidenceTab?.props.onClick as () => void)();

    expect(onChange).toHaveBeenCalledWith("evidence");
  });

  it("keeps every workspace tabpanel in the DOM with hidden inactive panels", () => {
    const markup = renderWorkspace();

    expect(markup).toContain('id="');
    expect(markup).toContain('-review-panel"');
    expect(markup).toContain('-evidence-panel"');
    expect(markup).toContain('-history-panel"');
    expect(markup).toContain('-summary-panel"');
    expect(markup).toContain('role="tabpanel"');
    expect(markup).toContain('aria-labelledby="');
    expect(markup).toContain("-review-tab");
    expect(markup).toContain("-evidence-tab");
    expect(markup).toContain("-history-tab");
    expect(markup).toContain("-summary-tab");
    expect(markup).toContain('hidden=""');
  });

  it("supports roving tab keyboard navigation for workspace tabs", () => {
    const onChange = vi.fn();
    const focus = vi.fn();
    const getElementById = vi.fn(() => ({ focus }));
    vi.stubGlobal("document", { getElementById });
    const tabTree = WorkspaceTabs({
      activeTab: "review",
      onChange,
      tabPrefix: "client"
    });
    const tabs = findElements(
      tabTree,
      (element) => element.type === "button" && element.props.role === "tab"
    );
    const reviewTab = tabs.find(
      (tab) => textContent(tab.props.children) === "Review"
    );
    const evidenceTab = tabs.find(
      (tab) => textContent(tab.props.children) === "Evidence & Sources"
    );
    const preventDefault = vi.fn();

    expect(reviewTab?.props.tabIndex).toBe(0);
    expect(evidenceTab?.props.tabIndex).toBe(-1);

    (
      reviewTab?.props.onKeyDown as (event: {
        key: string;
        preventDefault: () => void;
      }) => void
    )({ key: "ArrowRight", preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith("evidence");
    expect(getElementById).toHaveBeenCalledWith("client-evidence-tab");
    expect(focus).toHaveBeenCalled();
  });

  it("maps workspace keyboard shortcuts deterministically", () => {
    expect(nextWorkspaceTabFromKey("review", "ArrowRight")).toBe("evidence");
    expect(nextWorkspaceTabFromKey("review", "ArrowLeft")).toBe("summary");
    expect(nextWorkspaceTabFromKey("evidence", "Home")).toBe("review");
    expect(nextWorkspaceTabFromKey("evidence", "End")).toBe("summary");
    expect(nextWorkspaceTabFromKey("history", "Tab")).toBeNull();
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

  it("does not immediately present loading as an unprepared review", () => {
    const markup = renderWorkspace({
      isLoading: true,
      isPrepared: false,
      prepareButtonLabel: "Prepare Client Review",
      reviewData: null,
      reviewStatus: "Ready to prepare"
    });

    expect(markup).not.toContain("Loading review data");
    expect(markup).not.toContain("Review loading");
    expect(markup).not.toContain("Adviser loading");
    expect(markup).not.toContain("Actions loading");
    expect(markup).not.toContain(">Ready to prepare<");
    expect(markup).not.toContain("0 open actions");
    expect(markup).not.toContain(">Prepare Client Review</button>");
    expect(markup).toContain("disabled=");
  });

  it("delays the loading indicator on fast refresh", () => {
    vi.useFakeTimers();
    const onVisible = vi.fn();
    const cancel = scheduleInitialLoadingIndicator(onVisible);

    vi.advanceTimersByTime(initialLoadingIndicatorDelayMs - 1);
    expect(onVisible).not.toHaveBeenCalled();

    cancel();
    vi.advanceTimersByTime(1);
    expect(onVisible).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("shows delayed loading only after the loading threshold", () => {
    vi.useFakeTimers();
    const onVisible = vi.fn();
    scheduleInitialLoadingIndicator(onVisible);

    vi.advanceTimersByTime(initialLoadingIndicatorDelayMs);

    expect(onVisible).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("renders real review data instead of delayed loading once data arrives", () => {
    const markup = renderWorkspace({
      isLoading: false,
      isPrepared: true,
      reviewData: review
    });

    expect(markup).toContain("Alex Taylor");
    expect(markup).toContain("2026 Client Review");
    expect(markup).toContain("Re-run Preparation");
    expect(markup).not.toContain("Loading review data");
    expect(markup).not.toContain("Client review loading");
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
