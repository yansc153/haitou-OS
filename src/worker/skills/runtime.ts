/**
 * Skill Runtime — Qwen (通义千问) LLM caller
 *
 * Uses DashScope OpenAI-compatible API.
 * Tier mapping: tier3/4 → qwen-turbo, tier1/2 → qwen-plus, fallback → qwen-max
 *
 * Source: PROMPT_CONTRACT_SPEC.md
 */

import { PROMPT_CONTRACTS, type SkillContract } from './contracts.js';

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

const MODEL_TIERS: Record<string, string> = {
  tier1: 'qwen3.5-plus',
  tier2: 'qwen3.5-plus',
  tier3: 'qwen3.5-plus',
  tier4: 'qwen3.5-plus',
};

const ESCALATION_ORDER = ['tier4', 'tier3', 'tier2', 'tier1'];
const ESCALATION_MODEL = 'qwen3-max';

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
 * Execute a skill: load prompt contract → assemble input → call Qwen → parse → validate.
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

  // Retry once with format hint
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

  // Last resort: qwen-max
  console.log(`[skill] ${skillCode}: final escalation to qwen-max`);
  result = await callAndParse<T>(contract, ESCALATION_MODEL, inputJson);
  return result;
}

async function callAndParse<T>(
  contract: SkillContract,
  model: string,
  userContent: string
): Promise<SkillResult<T>> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'DASHSCOPE_API_KEY not configured', error_type: 'api_error' };
  }

  try {
    const response = await fetch(`${DASHSCOPE_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: contract.maxOutputTokens,
        messages: [
          { role: 'system', content: contract.systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Qwen API error ${response.status}: ${errText}`, error_type: 'api_error' };
    }

    const json = await response.json();
    const text = json.choices?.[0]?.message?.content || '';
    const usage = json.usage || {};

    // Extract JSON from response
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

    // Validate required fields from contract
    if (contract.requiredFields.length > 0) {
      const obj = parsed as Record<string, unknown>;
      const missing = contract.requiredFields.filter(f => !(f in obj) || obj[f] === undefined);
      if (missing.length > 0) {
        return {
          success: false,
          error: `Missing required fields: ${missing.join(', ')}`,
          error_type: 'validation_error',
        };
      }
    }

    return {
      success: true,
      output: parsed,
      model_used: model,
      tokens_used: {
        input: usage.prompt_tokens ?? 0,
        output: usage.completion_tokens ?? 0,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, error_type: 'api_error' };
  }
}

function extractJson(text: string): string | null {
  // Strip Qwen3 <think>...</think> reasoning blocks
  let trimmed = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim();

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);

  return null;
}
