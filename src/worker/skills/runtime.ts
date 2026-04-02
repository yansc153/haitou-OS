/**
 * Skill Runtime — LLM caller, prompt assembly, output validation
 *
 * This is the ~200 line core that replaces a "harness engine".
 * Each skill invocation: load prompt → assemble input → call Claude → parse JSON → validate.
 *
 * Source: PROMPT_CONTRACT_SPEC.md
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § Module 4: Skill Runtime
 */

import Anthropic from '@anthropic-ai/sdk';
import { PROMPT_CONTRACTS, type SkillContract } from './contracts.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Model tier mapping per BACKEND_API_AND_ARCHITECTURE_SPEC
const MODEL_TIERS: Record<string, string> = {
  tier1: 'claude-sonnet-4-20250514',
  tier2: 'claude-sonnet-4-20250514',
  tier3: 'claude-haiku-4-5-20251001',
  tier4: 'claude-haiku-4-5-20251001',
};

const ESCALATION_ORDER = ['tier4', 'tier3', 'tier2', 'tier1'];

export type SkillResult<T = Record<string, unknown>> = {
  success: true;
  output: T;
  model_used: string;
  tokens_used: { input: number; output: number };
} | {
  success: false;
  error: string;
  error_type: 'parse_error' | 'validation_error' | 'api_error' | 'contract_not_found';
};

/**
 * Execute a skill: load prompt contract → assemble input → call LLM → parse → validate.
 */
export async function executeSkill<T = Record<string, unknown>>(
  skillCode: string,
  input: Record<string, unknown>
): Promise<SkillResult<T>> {
  const contract = PROMPT_CONTRACTS[skillCode];
  if (!contract) {
    return { success: false, error: `No prompt contract for skill: ${skillCode}`, error_type: 'contract_not_found' };
  }

  const model = MODEL_TIERS[contract.modelTier];
  const inputJson = JSON.stringify(input);

  // Try with primary model
  let result = await callAndParse<T>(contract, model, inputJson);

  if (result.success) return result;

  // Retry once with same model (format error recovery)
  if (result.error_type === 'parse_error') {
    console.log(`[skill] ${skillCode}: parse error, retrying with format hint...`);
    result = await callAndParse<T>(
      contract,
      model,
      inputJson + '\n\nIMPORTANT: Your previous response was not valid JSON. Respond ONLY with the JSON object, no markdown or explanation.'
    );
    if (result.success) return result;
  }

  // Escalate to next model tier
  const currentTierIndex = ESCALATION_ORDER.indexOf(contract.modelTier);
  if (currentTierIndex < ESCALATION_ORDER.length - 1) {
    const nextTier = ESCALATION_ORDER[currentTierIndex + 1];
    const nextModel = MODEL_TIERS[nextTier];
    console.log(`[skill] ${skillCode}: escalating from ${contract.modelTier} to ${nextTier}`);
    result = await callAndParse<T>(contract, nextModel, inputJson);
    if (result.success) return result;
  }

  return result;
}

async function callAndParse<T>(
  contract: SkillContract,
  model: string,
  userContent: string
): Promise<SkillResult<T>> {
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: contract.maxOutputTokens,
      system: contract.systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Extract JSON from response (handle possible markdown wrapping)
    const jsonStr = extractJson(text);
    if (!jsonStr) {
      return {
        success: false,
        error: `Failed to extract JSON from response: ${text.slice(0, 200)}`,
        error_type: 'parse_error',
      };
    }

    let parsed: T;
    try {
      parsed = JSON.parse(jsonStr) as T;
    } catch {
      return {
        success: false,
        error: `Invalid JSON: ${jsonStr.slice(0, 200)}`,
        error_type: 'parse_error',
      };
    }

    return {
      success: true,
      output: parsed,
      model_used: model,
      tokens_used: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, error_type: 'api_error' };
  }
}

function extractJson(text: string): string | null {
  // Try raw text first
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  // Try extracting from markdown code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  // Try finding first { to last }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
}
