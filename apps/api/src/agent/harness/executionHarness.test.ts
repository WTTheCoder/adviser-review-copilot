import { z } from "zod";
import { describe, expect, it } from "vitest";
import { ExecutionHarness } from "./executionHarness.js";
import { SkillRegistry } from "../registry/skillRegistry.js";
import { ToolRegistry } from "../tools/toolRegistry.js";
import type { SkillDefinition } from "../skills/skillTypes.js";
import type { ToolDefinition } from "../tools/toolTypes.js";

const inputSchema = z.object({ value: z.string() });
const outputSchema = z.object({ result: z.string() });
const alternateOutputSchema = z.object({ bad: z.string() });

const createTool = (
  name = "demo.echo",
  output: unknown = { result: "ok" }
): ToolDefinition<typeof inputSchema, typeof outputSchema> => ({
  name,
  description: "Echo demo tool",
  inputSchema,
  outputSchema,
  execute: async () => output as z.infer<typeof outputSchema>
});

const createSkill = (
  name = "demo-skill",
  allowedTools: readonly string[] = ["demo.echo"],
  execute?: SkillDefinition<typeof inputSchema, typeof outputSchema>["execute"]
): SkillDefinition<typeof inputSchema, typeof outputSchema> => ({
  name,
  description: "Demo skill",
  inputSchema,
  outputSchema,
  allowedTools,
  execute:
    execute ??
    (async (input, context) =>
      context.toolRegistry.execute(
        "demo.echo",
        input,
        allowedTools,
        context,
        outputSchema
      ))
});

describe("agent registries and harness", () => {
  it("rejects duplicate skill registration", () => {
    const registry = new SkillRegistry();
    registry.register(createSkill());

    expect(() => registry.register(createSkill())).toThrow(
      "Skill already registered"
    );
  });

  it("rejects duplicate tool registration", () => {
    const registry = new ToolRegistry();
    registry.register(createTool());

    expect(() => registry.register(createTool())).toThrow("Tool already registered");
  });

  it("rejects an unknown skill safely", async () => {
    const result = await new ExecutionHarness(
      new SkillRegistry(),
      new ToolRegistry()
    ).execute("missing", {}, outputSchema);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("SKILL_NOT_FOUND");
    expect(result.ok ? null : result.error.message).not.toContain("stack");
  });

  it("rejects invalid skill input", async () => {
    const skills = new SkillRegistry();
    const tools = new ToolRegistry();
    skills.register(createSkill());
    tools.register(createTool());

    const result = await new ExecutionHarness(skills, tools).execute(
      "demo-skill",
      { value: 42 },
      outputSchema
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("INVALID_SKILL_INPUT");
  });

  it("rejects invalid skill output", async () => {
    const skills = new SkillRegistry();
    const tools = new ToolRegistry();
    const skillWithDifferentOutput: SkillDefinition<
      typeof inputSchema,
      typeof alternateOutputSchema
    > = {
      name: "demo-skill",
      description: "Demo skill with a different output contract",
      inputSchema,
      outputSchema: alternateOutputSchema,
      allowedTools: [],
      execute: async () => ({ bad: "shape" })
    };
    skills.register(skillWithDifferentOutput);

    const result = await new ExecutionHarness(skills, tools).execute(
      "demo-skill",
      { value: "ok" },
      outputSchema
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("INVALID_SKILL_OUTPUT");
  });

  it("rejects invalid tool input", async () => {
    const skills = new SkillRegistry();
    const tools = new ToolRegistry();
    skills.register(
      createSkill("demo-skill", ["demo.echo"], async (_input, context) =>
        context.toolRegistry.execute(
          "demo.echo",
          { value: 42 },
          ["demo.echo"],
          context,
          outputSchema
        )
      )
    );
    tools.register(createTool());

    const result = await new ExecutionHarness(skills, tools).execute(
      "demo-skill",
      { value: "ok" },
      outputSchema
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("INVALID_TOOL_INPUT");
  });

  it("rejects an unknown tool safely", async () => {
    const skills = new SkillRegistry();
    const tools = new ToolRegistry();
    skills.register(
      createSkill("demo-skill", ["missing.echo"], async (input, context) =>
        context.toolRegistry.execute(
          "missing.echo",
          input,
          ["missing.echo"],
          context,
          outputSchema
        )
      )
    );

    const result = await new ExecutionHarness(skills, tools).execute(
      "demo-skill",
      { value: "ok" },
      outputSchema
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("TOOL_NOT_FOUND");
    expect(result.ok ? null : result.error.message).not.toContain("stack");
  });

  it("rejects invalid tool output", async () => {
    const skills = new SkillRegistry();
    const tools = new ToolRegistry();
    skills.register(createSkill());
    tools.register(createTool("demo.echo", { bad: "shape" }));

    const result = await new ExecutionHarness(skills, tools).execute(
      "demo-skill",
      { value: "ok" },
      outputSchema
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("INVALID_TOOL_OUTPUT");
  });

  it("prevents a skill from using a tool outside its allowlist", async () => {
    const skills = new SkillRegistry();
    const tools = new ToolRegistry();
    skills.register(createSkill("demo-skill", []));
    tools.register(createTool());

    const result = await new ExecutionHarness(skills, tools).execute(
      "demo-skill",
      { value: "ok" },
      outputSchema
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("TOOL_NOT_ALLOWED");
  });

  it("records ordered events and tool invocations", async () => {
    const skills = new SkillRegistry();
    const tools = new ToolRegistry();
    skills.register(createSkill());
    tools.register(createTool());

    const result = await new ExecutionHarness(skills, tools).execute(
      "demo-skill",
      { value: "ok" },
      outputSchema
    );

    expect(result.ok).toBe(true);
    expect(result.ok ? result.metadata.events.map((event) => event.sequence) : []).toEqual(
      [1, 2, 3, 4, 5]
    );
    expect(tools.getInvocations()).toEqual([{ sequence: 1, toolName: "demo.echo" }]);
  });
});
