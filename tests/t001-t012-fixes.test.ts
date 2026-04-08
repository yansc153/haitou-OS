/**
 * Tests for T001-T012 harness fixes
 * Validates the logic changes without requiring DB or API connections
 */
import { describe, it, expect } from 'vitest';
import { validateOpportunityTransition } from '../src/shared/state-machines';
import { OpportunityStage } from '../src/shared/enums';
import { PROMPT_CONTRACTS } from '../src/worker/skills/contracts';

// ═══════════════════════════════════════
// T004: State machine validation in pipeline
// ═══════════════════════════════════════
describe('T004: Pipeline stage transitions must be validated', () => {
  it('allows discovered → screened', () => {
    expect(validateOpportunityTransition(
      OpportunityStage.Discovered, OpportunityStage.Screened
    ).valid).toBe(true);
  });

  it('allows screened → prioritized', () => {
    expect(validateOpportunityTransition(
      OpportunityStage.Screened, OpportunityStage.Prioritized
    ).valid).toBe(true);
  });

  it('allows prioritized → material_ready (full_tailored)', () => {
    expect(validateOpportunityTransition(
      OpportunityStage.Prioritized, OpportunityStage.MaterialReady
    ).valid).toBe(true);
  });

  it('allows prioritized → submitted (passthrough)', () => {
    expect(validateOpportunityTransition(
      OpportunityStage.Prioritized, OpportunityStage.Submitted
    ).valid).toBe(true);
  });

  it('allows material_ready → submitted', () => {
    expect(validateOpportunityTransition(
      OpportunityStage.MaterialReady, OpportunityStage.Submitted
    ).valid).toBe(true);
  });

  it('BLOCKS discovered → submitted (skip screening)', () => {
    const result = validateOpportunityTransition(
      OpportunityStage.Discovered, OpportunityStage.Submitted
    );
    expect(result.valid).toBe(false);
  });

  it('BLOCKS discovered → material_ready (skip screening+prioritize)', () => {
    const result = validateOpportunityTransition(
      OpportunityStage.Discovered, OpportunityStage.MaterialReady
    );
    expect(result.valid).toBe(false);
  });

  it('BLOCKS screened → submitted (skip prioritize)', () => {
    const result = validateOpportunityTransition(
      OpportunityStage.Screened, OpportunityStage.Submitted
    );
    expect(result.valid).toBe(false);
  });
});

// ═══════════════════════════════════════
// T010: Task type priority algorithm
// ═══════════════════════════════════════
describe('T010: Task-type priority ranking', () => {
  const TASK_TYPE_PRIORITY: Record<string, number> = {
    handoff_takeover: 7,
    reply_processing: 6,
    follow_up: 5,
    submission: 4,
    material_generation: 3,
    first_contact: 3,
    screening: 2,
    opportunity_discovery: 1,
  };

  it('handoff > reply > follow_up > submission > material > screening > discovery', () => {
    const types = Object.entries(TASK_TYPE_PRIORITY)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);

    expect(types[0]).toBe('handoff_takeover');
    expect(types[1]).toBe('reply_processing');
    expect(types[2]).toBe('follow_up');
    expect(types[3]).toBe('submission');
    // material_generation and first_contact are equal priority
    expect(TASK_TYPE_PRIORITY.material_generation).toBe(TASK_TYPE_PRIORITY.first_contact);
    expect(types[types.length - 1]).toBe('opportunity_discovery');
  });

  it('sorts mixed tasks correctly', () => {
    const tasks = [
      { task_type: 'opportunity_discovery' },
      { task_type: 'handoff_takeover' },
      { task_type: 'screening' },
      { task_type: 'reply_processing' },
      { task_type: 'submission' },
      { task_type: 'follow_up' },
    ];

    tasks.sort((a, b) => {
      const pa = TASK_TYPE_PRIORITY[a.task_type] ?? 0;
      const pb = TASK_TYPE_PRIORITY[b.task_type] ?? 0;
      return pb - pa;
    });

    expect(tasks[0].task_type).toBe('handoff_takeover');
    expect(tasks[1].task_type).toBe('reply_processing');
    expect(tasks[2].task_type).toBe('follow_up');
    expect(tasks[3].task_type).toBe('submission');
    expect(tasks[4].task_type).toBe('screening');
    expect(tasks[5].task_type).toBe('opportunity_discovery');
  });
});

// ═══════════════════════════════════════
// T012: Skill output validation
// ═══════════════════════════════════════
describe('T012: All skill contracts have requiredFields', () => {
  const skills = Object.keys(PROMPT_CONTRACTS);

  it('all skill contracts exist (12 original + analyze-resume)', () => {
    expect(skills.length).toBeGreaterThanOrEqual(12);
  });

  skills.forEach(skillCode => {
    it(`${skillCode} has non-empty requiredFields`, () => {
      const contract = PROMPT_CONTRACTS[skillCode];
      expect(contract.requiredFields).toBeDefined();
      expect(contract.requiredFields.length).toBeGreaterThan(0);
    });
  });

  it('fit-evaluation requires fit_posture, fit_reason_tags, dimension_scores', () => {
    expect(PROMPT_CONTRACTS['fit-evaluation'].requiredFields).toEqual(
      expect.arrayContaining(['fit_posture', 'fit_reason_tags', 'dimension_scores'])
    );
  });

  it('recommendation-generation requires recommendation', () => {
    expect(PROMPT_CONTRACTS['recommendation-generation'].requiredFields).toContain('recommendation');
  });

  it('cover-letter-generation requires full_text', () => {
    expect(PROMPT_CONTRACTS['cover-letter-generation'].requiredFields).toContain('full_text');
  });

  it('reply-reading requires handoff_recommended', () => {
    expect(PROMPT_CONTRACTS['reply-reading'].requiredFields).toContain('handoff_recommended');
  });
});

// ═══════════════════════════════════════
// T012: Validation logic simulation
// ═══════════════════════════════════════
describe('T012: Required field validation logic', () => {
  function validateOutput(requiredFields: string[], output: Record<string, unknown>) {
    return requiredFields.filter(f => !(f in output) || output[f] === undefined);
  }

  it('passes when all required fields present', () => {
    const missing = validateOutput(
      ['fit_posture', 'fit_reason_tags'],
      { fit_posture: 'strong_fit', fit_reason_tags: ['skill_match'] }
    );
    expect(missing).toEqual([]);
  });

  it('catches missing fields', () => {
    const missing = validateOutput(
      ['fit_posture', 'fit_reason_tags', 'dimension_scores'],
      { wrong_field: true }
    );
    expect(missing).toEqual(['fit_posture', 'fit_reason_tags', 'dimension_scores']);
  });

  it('catches undefined values', () => {
    const missing = validateOutput(
      ['recommendation'],
      { recommendation: undefined }
    );
    expect(missing).toEqual(['recommendation']);
  });

  it('allows null values (field present but nullable)', () => {
    const missing = validateOutput(
      ['recommendation'],
      { recommendation: null }
    );
    expect(missing).toEqual([]);
  });
});

// ═══════════════════════════════════════
// T005: Retry backoff filter logic
// ═══════════════════════════════════════
describe('T005: Retry backoff filtering', () => {
  function shouldDispatch(task: { last_retry_at: string | null }, now: Date): boolean {
    if (task.last_retry_at === null) return true;
    return new Date(task.last_retry_at) <= now;
  }

  it('dispatches task with no retry_at (new task)', () => {
    expect(shouldDispatch({ last_retry_at: null }, new Date())).toBe(true);
  });

  it('dispatches task with elapsed backoff', () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString();
    expect(shouldDispatch({ last_retry_at: pastTime }, new Date())).toBe(true);
  });

  it('blocks task still in backoff', () => {
    const futureTime = new Date(Date.now() + 60_000).toISOString();
    expect(shouldDispatch({ last_retry_at: futureTime }, new Date())).toBe(false);
  });
});

// ═══════════════════════════════════════
// T011: TeamStatus gate
// ═══════════════════════════════════════
describe('T011: team-start status gate', () => {
  const ALLOWED = ['ready', 'paused', 'active'];

  function canStart(teamStatus: string): boolean {
    return ALLOWED.includes(teamStatus);
  }

  it('allows ready', () => expect(canStart('ready')).toBe(true));
  it('allows paused', () => expect(canStart('paused')).toBe(true));
  it('allows active (idempotent)', () => expect(canStart('active')).toBe(true));
  it('blocks draft', () => expect(canStart('draft')).toBe(false));
  it('blocks onboarding', () => expect(canStart('onboarding')).toBe(false));
  it('blocks activation_pending', () => expect(canStart('activation_pending')).toBe(false));
  it('blocks archived', () => expect(canStart('archived')).toBe(false));
});

// ═══════════════════════════════════════
// T002: Handoff detection boundary patterns
// ═══════════════════════════════════════
describe('T002: Boundary detection patterns', () => {
  // Replicate the regex patterns from handoff-detection.ts
  const SALARY_PATTERNS = [/薪资/, /工资/, /待遇/, /salary/i, /compensation/i];
  const INTERVIEW_PATTERNS = [/面试/, /interview/i, /schedule\s*(?:a|an|the)\s*(?:call|meeting)/i];
  const PRIVATE_PATTERNS = [/微信/, /加我/, /电话/, /phone\s*number/i, /whatsapp/i];

  function detectsBoundary(text: string, patterns: RegExp[]): boolean {
    return patterns.some(p => p.test(text));
  }

  it('detects 薪资 discussion', () => {
    expect(detectsBoundary('请问您的期望薪资是多少？', SALARY_PATTERNS)).toBe(true);
  });

  it('detects salary in English', () => {
    expect(detectsBoundary('What are your salary expectations?', SALARY_PATTERNS)).toBe(true);
  });

  it('detects 面试 scheduling', () => {
    expect(detectsBoundary('我们想安排一轮面试', INTERVIEW_PATTERNS)).toBe(true);
  });

  it('detects interview in English', () => {
    expect(detectsBoundary('Can we schedule a call next week?', INTERVIEW_PATTERNS)).toBe(true);
  });

  it('detects WeChat request', () => {
    expect(detectsBoundary('方便加个微信吗？', PRIVATE_PATTERNS)).toBe(true);
  });

  it('does not false-positive on normal message', () => {
    expect(detectsBoundary('Thank you for your application. We will review it.', SALARY_PATTERNS)).toBe(false);
    expect(detectsBoundary('Thank you for your application. We will review it.', INTERVIEW_PATTERNS)).toBe(false);
    expect(detectsBoundary('Thank you for your application. We will review it.', PRIVATE_PATTERNS)).toBe(false);
  });
});
