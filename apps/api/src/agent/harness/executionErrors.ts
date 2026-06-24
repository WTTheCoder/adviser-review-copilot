export type ExecutionErrorCode =
  | "SKILL_NOT_FOUND"
  | "INVALID_SKILL_INPUT"
  | "INVALID_SKILL_OUTPUT"
  | "TOOL_NOT_ALLOWED"
  | "TOOL_NOT_FOUND"
  | "INVALID_TOOL_INPUT"
  | "INVALID_TOOL_OUTPUT"
  | "INVALID_ADVISER_DECISION"
  | "SKILL_EXECUTION_FAILED"
  | "PDF_INVALID_SIGNATURE"
  | "PDF_TOO_LARGE"
  | "PDF_PARSE_FAILED"
  | "PDF_ENCRYPTED"
  | "PDF_PASSWORD_PROTECTED"
  | "PDF_PARSE_TIMEOUT"
  | "PDF_PAGE_LIMIT_EXCEEDED"
  | "PDF_TEXT_NOT_AVAILABLE"
  | "PDF_EXTRACTED_TEXT_TOO_LARGE"
  | "PDF_UNSUPPORTED_FEATURE";

const defaultMessages: Record<ExecutionErrorCode, string> = {
  SKILL_NOT_FOUND: "The requested skill is not available.",
  INVALID_SKILL_INPUT: "The skill input was invalid.",
  INVALID_SKILL_OUTPUT: "The skill output was invalid.",
  TOOL_NOT_ALLOWED: "The skill attempted to use a tool that is not allowed.",
  TOOL_NOT_FOUND: "The requested tool is not available.",
  INVALID_TOOL_INPUT: "The tool input was invalid.",
  INVALID_TOOL_OUTPUT: "The tool output was invalid.",
  INVALID_ADVISER_DECISION:
    "This adviser decision is not valid for the current candidate state.",
  SKILL_EXECUTION_FAILED: "The skill execution failed.",
  PDF_INVALID_SIGNATURE: "The selected file is not a valid PDF.",
  PDF_TOO_LARGE: "The PDF is too large for this local demo.",
  PDF_PARSE_FAILED: "The PDF could not be read.",
  PDF_ENCRYPTED: "Encrypted PDFs are not supported.",
  PDF_PASSWORD_PROTECTED: "Password-protected PDFs are not supported.",
  PDF_PARSE_TIMEOUT: "The PDF took too long to read.",
  PDF_PAGE_LIMIT_EXCEEDED: "The PDF has too many pages for this local demo.",
  PDF_TEXT_NOT_AVAILABLE:
    "No selectable text was found. OCR for scanned PDFs is not supported yet.",
  PDF_EXTRACTED_TEXT_TOO_LARGE:
    "The extracted PDF text is too large for this local demo.",
  PDF_UNSUPPORTED_FEATURE: "This PDF uses a feature that is not supported."
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
