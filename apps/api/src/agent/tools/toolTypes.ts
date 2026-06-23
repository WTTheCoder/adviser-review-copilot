import type { z } from "zod";
import type { ExecutionContext } from "../harness/executionContext.js";

export type ToolRisk = "LOW" | "MEDIUM" | "HIGH";

export type ToolDefinition<
  TInputSchema extends z.ZodType,
  TOutputSchema extends z.ZodType
> = {
  name: string;
  description: string;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  risk?: ToolRisk;
  execute: (
    input: z.infer<TInputSchema>,
    context: ExecutionContext
  ) => Promise<z.infer<TOutputSchema>>;
};

export type RegisteredTool = ToolDefinition<z.ZodType, z.ZodType>;
