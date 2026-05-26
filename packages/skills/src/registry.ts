import { Skill, SkillDefinition } from '@wecom-bot/core';

export class SkillRegistry {
  private skills = new Map<string, Skill>();

  register(skill: Skill): void {
    if (this.skills.has(skill.definition.name)) {
      console.warn('Skill ' + skill.definition.name + ' already registered, overwriting');
    }
    this.skills.set(skill.definition.name, skill);
  }

  registerAll(skills: Skill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  getDefinitions(names: string[]): Array<{
    type: 'function';
    function: SkillDefinition;
  }> {
    return names
      .map(function(name) { return this.skills.get(name); }.bind(this))
      .filter(function(s): s is Skill { return s !== undefined; })
      .map(function(s) { return { type: 'function' as const, function: s.definition }; });
  }

  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error('Skill ' + name + ' not registered');
    }
    return skill.execute(args);
  }

  list(): string[] {
    return Array.from(this.skills.keys());
  }
}
