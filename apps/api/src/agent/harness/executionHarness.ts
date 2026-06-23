import type { z } from "zod";
import type { SkillRegistry } from "../registry/skillRegistry.js";
import type { ToolRegistry } from "../tools/toolRegistry.js";
import { createExecutionContext } from "./executionContext.js";
import { ExecutionError, toSafeExecutionError } from "./executionErrors.js";
import type { ExecutionResult } from "./executionResult.js";

export class ExecutionHarness {
  constructor(
    private readonly skillRegistry: SkillRegistry,
    private readonly toolRegistry: ToolRegistry
  ) {}

  async execute<TOutputSchema extends z.ZodType>(
    skillName: string,
    input: unknown,
    outputSchema: TOutputSchema,
    clientId?: string
  ): Promise<ExecutionResult<z.infer<TOutputSchema>>> {
    let skill;

    try {
      skill = this.skillRegistry.get(skillName);
    } catch (error) {
      const safeError = toSafeExecutionError(error);
      return {
        ok: false,
        error: {
          code: safeError.code,
          message: safeError.message
        },
        metadata: {
          skillName,
          skillVersion: null,
          status: "FAILED",
          events: []
        }
      };
    }

    const context = createExecutionContext(
      skill.name,
      skill.version ?? null,
      this.toolRegistry,
      clientId
    );

    try {
      context.recordEvent({
        label: `Skill selected: ${skill.name}`,
        status: "STARTED",
        detail: skill.description
      });

      const inputResult = skill.inputSchema.safeParse(input);
      if (!inputResult.success) {
        throw new ExecutionError("INVALID_SKILL_INPUT");
      }
      context.recordEvent({ label: "Skill input validated" });

      const output = await skill.execute(inputResult.data, context);
      const outputResult = outputSchema.safeParse(output);
      const skillOutputResult = skill.outputSchema.safeParse(output);
      if (!outputResult.success || !skillOutputResult.success) {
        throw new ExecutionError("INVALID_SKILL_OUTPUT");
      }

      context.recordEvent({ label: "Skill output validated" });
      context.recordEvent({ label: `Skill completed: ${skill.name}` });

      return {
        ok: true,
        output: outputResult.data,
        metadata: {
          skillName: skill.name,
          skillVersion: skill.version ?? null,
          status: "SUCCEEDED",
          events: context.getEvents()
        }
      };
    } catch (error) {
      const safeError = toSafeExecutionError(error);
      context.recordFailure(safeError.code);

      return {
        ok: false,
        error: {
          code: safeError.code,
          message: safeError.message
        },
        metadata: {
          skillName: skill.name,
          skillVersion: skill.version ?? null,
          status: "FAILED",
          events: context.getEvents()
        }
      };
    }
  }
}
