import type { z } from "zod";
import { ExecutionError } from "../harness/executionErrors.js";
import type { ExecutionContext } from "../harness/executionContext.js";
import type { RegisteredTool } from "./toolTypes.js";

export type ToolInvocation = {
  sequence: number;
  toolName: string;
};

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();
  private readonly invocations: ToolInvocation[] = [];

  register(tool: RegisteredTool) {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }

    this.tools.set(tool.name, tool);
  }

  metadata() {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      risk: tool.risk ?? "LOW"
    }));
  }

  getInvocations() {
    return [...this.invocations];
  }

  async execute<TOutputSchema extends z.ZodType>(
    toolName: string,
    input: unknown,
    allowedToolNames: readonly string[],
    context: ExecutionContext,
    outputSchema: TOutputSchema
  ): Promise<z.infer<TOutputSchema>> {
    if (!allowedToolNames.includes(toolName)) {
      throw new ExecutionError("TOOL_NOT_ALLOWED");
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ExecutionError("TOOL_NOT_FOUND");
    }

    const inputResult = tool.inputSchema.safeParse(input);
    if (!inputResult.success) {
      throw new ExecutionError("INVALID_TOOL_INPUT");
    }

    context.recordEvent({
      label: `Tool invoked: ${toolName}`,
      status: "COMPLETE",
      detail: tool.description
    });
    this.invocations.push({
      sequence: this.invocations.length + 1,
      toolName
    });

    const output = await tool.execute(inputResult.data, context);
    const outputResult = outputSchema.safeParse(output);

    if (!outputResult.success || !tool.outputSchema.safeParse(output).success) {
      throw new ExecutionError("INVALID_TOOL_OUTPUT");
    }

    return outputResult.data;
  }
}
