import type { SkillDefinition } from "./types";

// ─── Skill Registry ─────────────────────────────────────────

const SKILL_REGISTRY = new Map<string, SkillDefinition>();

export function registerSkill(skill: SkillDefinition): void {
  SKILL_REGISTRY.set(skill.slug, skill);
}

export function getSkill(slug: string): SkillDefinition | undefined {
  return SKILL_REGISTRY.get(slug);
}

export function listSkills(): SkillDefinition[] {
  return Array.from(SKILL_REGISTRY.values());
}

export function listSkillsByCategory(category: string): SkillDefinition[] {
  return Array.from(SKILL_REGISTRY.values()).filter(
    (s) => s.category === category
  );
}
