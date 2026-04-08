/**
 * Unit Tests: Pipeline Logic
 * Tests assembleResumeText, JSON field parsing, name splitting
 */
import { describe, it, expect } from 'vitest';

// Extract and test assembleResumeText logic
function parseJsonField(val: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

function parseSkills(rawSkills: unknown): string[] {
  if (Array.isArray(rawSkills)) return rawSkills;
  if (typeof rawSkills === 'string') { try { return JSON.parse(rawSkills); } catch { return []; } }
  return [];
}

function assembleResumeText(baseline: Record<string, unknown>): string {
  const parts: string[] = [];
  if (baseline.headline_summary) parts.push(baseline.headline_summary as string);

  const experiences = parseJsonField(baseline.experiences);
  if (experiences.length > 0) {
    parts.push('\n--- Experience ---');
    for (const exp of experiences) {
      parts.push(`${exp.job_title} at ${exp.company_name}`);
    }
  }

  const skills = parseSkills(baseline.skills);
  if (skills.length > 0) {
    parts.push('\n--- Skills ---');
    parts.push(skills.join(', '));
  }

  return parts.join('\n').trim();
}

describe('assembleResumeText', () => {
  it('handles skills as JSON string (from DB)', () => {
    const baseline = {
      headline_summary: 'Engineer',
      skills: '["JavaScript","Python","React"]',
      experiences: '[]',
    };
    const text = assembleResumeText(baseline);
    expect(text).toContain('JavaScript, Python, React');
  });

  it('handles skills as array', () => {
    const baseline = {
      skills: ['Go', 'Rust', 'Docker'],
      experiences: [],
    };
    const text = assembleResumeText(baseline);
    expect(text).toContain('Go, Rust, Docker');
  });

  it('handles experiences as JSON string', () => {
    const baseline = {
      experiences: JSON.stringify([
        { job_title: 'Engineer', company_name: 'Google' },
      ]),
      skills: [],
    };
    const text = assembleResumeText(baseline);
    expect(text).toContain('Engineer at Google');
  });

  it('handles empty/null fields gracefully', () => {
    const baseline = { skills: null, experiences: undefined };
    const text = assembleResumeText(baseline);
    expect(text).toBe('');
  });
});

// Test name splitting for Greenhouse
function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  if (trimmed.includes(' ')) {
    const parts = trimmed.split(' ');
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }
  const isCJK = /^[\u4e00-\u9fff\u3400-\u4dbf]+$/.test(trimmed);
  if (isCJK && trimmed.length >= 2) {
    return { firstName: trimmed.slice(1), lastName: trimmed[0] };
  }
  return { firstName: trimmed, lastName: trimmed };
}

describe('splitName', () => {
  it('splits Western name', () => {
    expect(splitName('John Smith')).toEqual({ firstName: 'John', lastName: 'Smith' });
  });

  it('splits Western name with middle', () => {
    expect(splitName('John Michael Smith')).toEqual({ firstName: 'John', lastName: 'Michael Smith' });
  });

  it('splits Chinese name (2 chars)', () => {
    expect(splitName('张三')).toEqual({ firstName: '三', lastName: '张' });
  });

  it('splits Chinese name (3 chars)', () => {
    expect(splitName('张小明')).toEqual({ firstName: '小明', lastName: '张' });
  });

  it('handles empty string', () => {
    expect(splitName('')).toEqual({ firstName: '', lastName: '' });
  });

  it('handles single English name', () => {
    expect(splitName('Pepper')).toEqual({ firstName: 'Pepper', lastName: 'Pepper' });
  });
});

// Test Qwen response parsing (think tag stripping)
function extractJson(text: string): string | null {
  let trimmed = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);
  return null;
}

describe('extractJson (Qwen response parsing)', () => {
  it('parses raw JSON', () => {
    expect(extractJson('{"a": 1}')).toBe('{"a": 1}');
  });

  it('strips think tags', () => {
    const input = '<think>Let me analyze...</think>{"result": "ok"}';
    expect(extractJson(input)).toBe('{"result": "ok"}');
  });

  it('strips markdown fences', () => {
    const input = '```json\n{"x": 42}\n```';
    expect(extractJson(input)).toBe('{"x": 42}');
  });

  it('extracts JSON from mixed text', () => {
    const input = 'Here is the result: {"fit": "strong"} hope that helps';
    expect(extractJson(input)).toBe('{"fit": "strong"}');
  });

  it('handles think + fence combo', () => {
    const input = '<think>thinking...</think>\n```json\n{"data": true}\n```';
    expect(extractJson(input)).toBe('{"data": true}');
  });

  it('returns null for no JSON', () => {
    expect(extractJson('no json here')).toBeNull();
  });
});
