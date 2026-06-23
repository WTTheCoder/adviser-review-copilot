import { ExecutionError } from "../harness/executionErrors.js";
import type { RegisteredSkill } from "../skills/skillTypes.js";

export class SkillRegistry {
  private readonly skills = new Map<string, RegisteredSkill>();

  register(skill: RegisteredSkill) {
    if (this.skills.has(skill.name)) {
      throw new Error(`Skill already registered: ${skill.name}`);
    }

    this.skills.set(skill.name, skill);
  }

  get(name: string) {
    const skill = this.skills.get(name);

    if (!skill) {
      throw new ExecutionError("SKILL_NOT_FOUND");
    }

    return skill;
  }

  metadata() {
    return [...this.skills.values()].map((skill) => ({
      name: skill.name,
      description: skill.description,
      version: skill.version ?? null,
      allowedTools: [...skill.allowedTools]
    }));
  }
}
