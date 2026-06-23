import type { z } from "zod";
import type { ExecutionContext } from "../harness/executionContext.js";

export type SkillDefinition<
  TInputSchema extends z.ZodType,
  TOutputSchema extends z.ZodType
> = {
  name: string;
  description: string;
  version?: string;
  idempotency?: string;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  allowedTools: readonly string[];
  execute: (
    input: z.infer<TInputSchema>,
    context: ExecutionContext
  ) => Promise<z.infer<TOutputSchema>>;
};

export type RegisteredSkill = SkillDefinition<z.ZodType, z.ZodType>;
