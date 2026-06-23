import { z } from "zod";
import { describe, expect, it } from "vitest";
import { ExecutionHarness } from "../harness/executionHarness.js";
import { SkillRegistry } from "../registry/skillRegistry.js";
import { ToolRegistry } from "./toolRegistry.js";
import { createAiExtractionTools } from "./aiExtractionTools.js";
import { MockCandidateFactExtractor } from "../../ai/providers/mockCandidateFactExtractor.js";
import type { SkillDefinition } from "../skills/skillTypes.js";
import { createExecutionContext } from "../harness/executionContext.js";
import { AiError } from "../../ai/errors/aiErrors.js";
import type { CandidateFactExtractor } from "../../ai/contracts/candidateFactExtractor.js";
import type { CandidateFactExtractionInput } from "../../ai/contracts/candidateFactExtractor.js";

const inputSchema = z.object({ note: z.string() });
const outputSchema = z.object({ candidateCount: z.number() });

const extractionInput: CandidateFactExtractionInput = {
  clientId: "demo-alex-taylor",
  clientDisplayName: "Alex Taylor",
  sourceRecordId: "source-meeting-note",
  sourceType: "ADVISER_MEETING_NOTE" as const,
  observedDate: "2026-06-04",
  meetingNoteText: "Alex may have moved to Subiaco.",
  supportedFields: ["ADDRESS"]
};

const createExtractionSkill = (
  allowedTools: readonly string[]
): SkillDefinition<typeof inputSchema, typeof outputSchema> => ({
  name: "demo-extraction",
  description: "Demo extraction skill",
  inputSchema,
  outputSchema,
  allowedTools,
  execute: async (_input, context) => {
    const result = await context.toolRegistry.execute(
      "ai.extractCandidateFacts",
      extractionInput,
      allowedTools,
      context,
      z.object({
        candidateFacts: z.array(z.unknown())
      })
    );
    return { candidateCount: result.candidateFacts.length };
  }
});

describe("AI extraction tool", () => {
  it("can only be called by an allowlisted skill", async () => {
    const skills = new SkillRegistry();
    const tools = new ToolRegistry();
    skills.register(createExtractionSkill([]));
    tools.register(
      ...createAiExtractionTools(new MockCandidateFactExtractor())
    );

    const result = await new ExecutionHarness(skills, tools).execute(
      "demo-extraction",
      { note: "ok" },
      outputSchema
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("TOOL_NOT_ALLOWED");
  });

  it("validates output and records safe fallback metadata", async () => {
    const skills = new SkillRegistry();
    const tools = new ToolRegistry();
    skills.register(createExtractionSkill(["ai.extractCandidateFacts"]));
    tools.register(
      ...createAiExtractionTools({
        extract: async () => {
          throw new Error("network down");
        }
      })
    );

    const result = await new ExecutionHarness(skills, tools).execute(
      "demo-extraction",
      { note: "ok" },
      outputSchema
    );

    expect(result.ok).toBe(true);
    expect(result.ok ? result.output.candidateCount : 0).toBe(1);
    expect(
      result.ok
        ? result.metadata.events.some((event) =>
            event.label.includes("fell back to mock provider")
          )
        : false
    ).toBe(true);
  });

  it("returns normal mock provenance without fallback warnings", async () => {
    const tool = createAiExtractionTools(new MockCandidateFactExtractor())[0];
    const context = createExecutionContext(
      "demo-extraction",
      null,
      new ToolRegistry()
    );

    const result = await tool.execute(
      tool.inputSchema.parse(extractionInput),
      context
    );

    expect(result.providerMode).toBe("mock");
    expect(result.warnings).toEqual([]);
  });

  it("returns successful OpenAI-shaped provenance without fallback", async () => {
    const openAiExtractor: CandidateFactExtractor = {
      extract: async () => ({
        providerMode: "openai",
        model: "example-model",
        candidateFacts: [],
        warnings: [],
        metadata: {
          durationMs: 1,
          sourceTextLength: 33,
          candidateCount: 0
        }
      })
    };
    const tool = createAiExtractionTools(openAiExtractor)[0];
    const context = createExecutionContext(
      "demo-extraction",
      null,
      new ToolRegistry()
    );

    const result = await tool.execute(
      tool.inputSchema.parse(extractionInput),
      context
    );

    expect(result.providerMode).toBe("openai");
    expect(result.model).toBe("example-model");
    expect(result.warnings).toEqual([]);
  });

  it.each([
    "AI_TIMEOUT",
    "AI_PROVIDER_ERROR",
    "AI_INVALID_OUTPUT",
    "AI_REFUSAL"
  ] as const)("falls back safely for %s", async (code) => {
    const failingExtractor: CandidateFactExtractor = {
      extract: async () => {
        throw new AiError(code);
      }
    };
    const tool = createAiExtractionTools(failingExtractor)[0];
    const context = createExecutionContext(
      "demo-extraction",
      null,
      new ToolRegistry()
    );

    const result = await tool.execute(
      tool.inputSchema.parse(extractionInput),
      context
    );

    expect(result.providerMode).toBe("mock");
    expect(result.warnings).toContain(
      "OpenAI extraction was unavailable. Mock extraction was used."
    );
    expect(
      context.getEvents().some((event) =>
        event.label.includes("fell back to mock provider")
      )
    ).toBe(true);
  });
});
