import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ReviewResponse } from "@client-review-prep/shared";
import { AdviserActions } from "./AdviserActions.js";
import {
  ClientReviewWorkspace,
  type ClientReviewWorkspaceProps
} from "./ClientReviewWorkspace.js";
import { CurrentClientPicture } from "./CurrentClientPicture.js";
import { EvidenceDrawer } from "./EvidenceDrawer.js";
import { SourceUploadPanel } from "./SourceUploadPanel.js";
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
  it("renders the existing prepared review sections", () => {
    const markup = renderWorkspace();

    expect(markup).toContain("Adviser Review Copilot");
    expect(markup).toContain("Source-backed preparation for client reviews");
    expect(markup).toContain("API connected");
    expect(markup).toContain("Facts reviewed");
    expect(markup).toContain("Current client picture");
    expect(markup).toContain("Meaningful changes");
    expect(markup).toContain("Adviser actions");
    expect(markup).toContain("View execution trace");
    expect(markup).toContain("Upload source note");
    expect(markup).toContain("Source records");
    expect(markup).toContain("2025 Annual Review");
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
    expect(markup).not.toContain("Current client picture");
  });

  it("keeps direct shell action callbacks wired", () => {
    const onPrepareReview = vi.fn();
    const onResetDemo = vi.fn();
    const tree = ClientReviewWorkspace(
      createWorkspaceProps({ onPrepareReview, onResetDemo })
    );
    const prepareButton = findElement(
      tree,
      (element) =>
        element.type === "button" &&
        textContent(element.props.children) === "Re-run Preparation"
    );
    const resetButton = findElement(
      tree,
      (element) =>
        element.type === "button" &&
        textContent(element.props.children) === "Reset local demo data"
    );

    expect(prepareButton?.props.onClick).toBe(onPrepareReview);
    expect(resetButton?.props.onClick).toBe(onResetDemo);
  });

  it("passes orchestration callbacks to composed workflow components", () => {
    const onSelectFact = vi.fn();
    const onDecision = vi.fn();
    const onUploaded = vi.fn();
    const onCloseEvidence = vi.fn();
    const tree = ClientReviewWorkspace(
      createWorkspaceProps({
        currentSelectedFact: review.clientFacts[0] ?? null,
        selectedFactAction: review.adviserActions[0] ?? null,
        onCloseEvidence,
        onDecision,
        onSelectFact,
        onUploaded
      })
    );
    const currentClientPicture = findElement(
      tree,
      (element) => element.type === CurrentClientPicture
    );
    const adviserActions = findElement(
      tree,
      (element) => element.type === AdviserActions
    );
    const sourceUploadPanel = findElement(
      tree,
      (element) => element.type === SourceUploadPanel
    );
    const evidenceDrawer = findElement(
      tree,
      (element) => element.type === EvidenceDrawer
    );

    expect(currentClientPicture?.props.onSelectFact).toBe(onSelectFact);
    expect(adviserActions?.props.onDecision).toBe(onDecision);
    expect(sourceUploadPanel?.props.onUploaded).toBe(onUploaded);
    expect(evidenceDrawer?.props.onClose).toBe(onCloseEvidence);
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

  it("shows upload execution trace when App passes the latest upload trace", () => {
    const markup = renderWorkspace({
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

    expect(markup).toContain("View upload execution trace");
    expect(markup).toContain("Upload request validated");
  });
});
