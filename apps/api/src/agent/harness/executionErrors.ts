export type ExecutionErrorCode =
  | "SKILL_NOT_FOUND"
  | "INVALID_SKILL_INPUT"
  | "INVALID_SKILL_OUTPUT"
  | "TOOL_NOT_ALLOWED"
  | "TOOL_NOT_FOUND"
  | "INVALID_TOOL_INPUT"
  | "INVALID_TOOL_OUTPUT"
  | "SKILL_EXECUTION_FAILED";

const defaultMessages: Record<ExecutionErrorCode, string> = {
  SKILL_NOT_FOUND: "The requested skill is not available.",
  INVALID_SKILL_INPUT: "The skill input was invalid.",
  INVALID_SKILL_OUTPUT: "The skill output was invalid.",
  TOOL_NOT_ALLOWED: "The skill attempted to use a tool that is not allowed.",
  TOOL_NOT_FOUND: "The requested tool is not available.",
  INVALID_TOOL_INPUT: "The tool input was invalid.",
  INVALID_TOOL_OUTPUT: "The tool output was invalid.",
  SKILL_EXECUTION_FAILED: "The skill execution failed."
};

export class ExecutionError extends Error {
  readonly code: ExecutionErrorCode;

  constructor(code: ExecutionErrorCode, message = defaultMessages[code]) {
    super(message);
    this.name = "ExecutionError";
    this.code = code;
  }
}

export const toSafeExecutionError = (error: unknown): ExecutionError => {
  if (error instanceof ExecutionError) {
    return error;
  }

  return new ExecutionError("SKILL_EXECUTION_FAILED");
};
