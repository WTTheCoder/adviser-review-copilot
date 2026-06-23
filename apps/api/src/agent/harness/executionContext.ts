import type { ToolRegistry } from "../tools/toolRegistry.js";
import type { ExecutionErrorCode } from "./executionErrors.js";

export type ExecutionEventStatus = "STARTED" | "COMPLETE" | "ESCALATED" | "FAILED";

export type ExecutionEvent = {
  sequence: number;
  label: string;
  status: ExecutionEventStatus;
  detail: string | null;
  timestamp: string;
};

type RecordEventInput = {
  label: string;
  status?: ExecutionEventStatus;
  detail?: string | null;
};

export type ExecutionContext = {
  skillName: string;
  skillVersion: string | null;
  clientId: string | null;
  toolRegistry: ToolRegistry;
  recordEvent: (event: RecordEventInput) => ExecutionEvent;
  recordFailure: (code: ExecutionErrorCode) => ExecutionEvent;
  getEvents: () => ExecutionEvent[];
};

export const createExecutionContext = (
  skillName: string,
  skillVersion: string | null,
  toolRegistry: ToolRegistry,
  clientId?: string
): ExecutionContext => {
  const events: ExecutionEvent[] = [];

  const recordEvent: ExecutionContext["recordEvent"] = ({
    label,
    status = "COMPLETE",
    detail = null
  }) => {
    const event = {
      sequence: events.length + 1,
      label,
      status,
      detail,
      timestamp: new Date().toISOString()
    };
    events.push(event);
    return event;
  };

  return {
    skillName,
    skillVersion,
    clientId: clientId ?? null,
    toolRegistry,
    recordEvent,
    recordFailure: (code) =>
      recordEvent({
        label: `Execution failed: ${code}`,
        status: "FAILED",
        detail: null
      }),
    getEvents: () => [...events]
  };
};
