import type { ExecutionEvent } from "./executionContext.js";
import type { ExecutionErrorCode } from "./executionErrors.js";

export type ExecutionMetadata = {
  skillName: string;
  skillVersion: string | null;
  status: "SUCCEEDED" | "FAILED";
  events: ExecutionEvent[];
};

export type ExecutionSuccess<TOutput> = {
  ok: true;
  output: TOutput;
  metadata: ExecutionMetadata;
};

export type ExecutionFailure = {
  ok: false;
  error: {
    code: ExecutionErrorCode;
    message: string;
  };
  metadata: ExecutionMetadata;
};

export type ExecutionResult<TOutput> =
  | ExecutionSuccess<TOutput>
  | ExecutionFailure;
