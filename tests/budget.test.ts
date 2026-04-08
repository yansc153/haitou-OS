/**
 * Unit Tests: Budget Service
 * Tests daily action budget logic — the critical bug where messages:0 exhausted budget immediately
 */
import { describe, it, expect } from 'vitest';

// Test the budget exhaustion logic directly (extracted from budget.ts)
function isBudgetExhausted(
  newApps: number, newMsgs: number,
  budgetApps: number, budgetMsgs: number,
): boolean {
  const appsExhausted = budgetApps > 0 && newApps >= budgetApps;
  const msgsExhausted = budgetMsgs > 0 && newMsgs >= budgetMsgs;
  return appsExhausted || msgsExhausted;
}

describe('Budget Exhaustion Logic', () => {
  it('does NOT exhaust when messages budget is 0 (greenhouse/lever/zhaopin/lagou)', () => {
    // First application: apps=1, msgs=0, budget: apps=30, msgs=0
    expect(isBudgetExhausted(1, 0, 30, 0)).toBe(false);
  });

  it('does NOT exhaust on first application', () => {
    expect(isBudgetExhausted(1, 0, 30, 10)).toBe(false);
  });

  it('exhausts when apps reach limit', () => {
    expect(isBudgetExhausted(30, 0, 30, 0)).toBe(true);
  });

  it('exhausts when messages reach limit', () => {
    expect(isBudgetExhausted(5, 10, 15, 10)).toBe(true);
  });

  it('does NOT exhaust when under both limits', () => {
    expect(isBudgetExhausted(14, 9, 15, 10)).toBe(false);
  });

  // THE BUG WE FIXED: messages:0 should never trigger exhaustion
  it('LinkedIn: 15 apps exhausts', () => {
    expect(isBudgetExhausted(15, 0, 15, 10)).toBe(true);
  });

  it('LinkedIn: 14 apps does not exhaust', () => {
    expect(isBudgetExhausted(14, 0, 15, 10)).toBe(false);
  });
});

// Test total_actions_count calculation (was off-by-one)
describe('Total Actions Count', () => {
  it('correctly sums new counts', () => {
    const existing = { applications_count: 5, messages_count: 2, searches_count: 10 };
    const actionType: string = 'application';

    const newApps = existing.applications_count + (actionType === 'application' ? 1 : 0);
    const newMsgs = existing.messages_count + (actionType === 'message' ? 1 : 0);
    const newSearch = existing.searches_count + (actionType === 'search' ? 1 : 0);
    const total = newApps + newMsgs + newSearch;

    expect(total).toBe(18); // 6 + 2 + 10 = 18
    expect(newApps).toBe(6);
  });
});
