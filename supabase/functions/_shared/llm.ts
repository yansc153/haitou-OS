/**
 * Qwen (通义千问) LLM wrapper for Supabase Edge Functions.
 * Uses DashScope OpenAI-compatible API.
 *
 * Tier mapping:
 * - tier4/tier3 (fast, cheap): qwen-turbo
 * - tier2/tier1 (standard): qwen-plus
 * - escalation fallback: qwen-max
 */

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const MODEL_TURBO = 'qwen3.5-plus';
const MODEL_PLUS = 'qwen3.5-plus';
const MODEL_MAX = 'qwen3-max';

const TRUTHFULNESS_LOCK = `
ABSOLUTE RULE: You must never invent, fabricate, or assume information not present in the provided context. If a field cannot be determined from the input, mark it as null or "unknown". Hallucinating data is the single most harmful failure mode.
`;

const LANGUAGE_AWARENESS = `
The input may be in Chinese, English, or a mix. Process the content in whatever language it appears. Your structured output field names must be in English (as specified in the schema), but text content fields should preserve the original language unless the task explicitly requires translation.
`;

export type LlmResult = {
  parsed: Record<string, unknown>;
  inputTokens: number;
  outputTokens: number;
  model: string;
};

/**
 * Call Qwen with a system prompt and user content, expecting JSON output.
 * Starts with qwen-turbo, retries with format hint, escalates to qwen-plus then qwen-max.
 */
export async function callHaiku(
  systemPrompt: string,
  userContent: string,
  maxOutputTokens = 2048,
): Promise<LlmResult> {
  const apiKey = Deno.env.get('DASHSCOPE_API_KEY');
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY not configured');

  const fullSystem = `${systemPrompt}\n\n${TRUTHFULNESS_LOCK}\n${LANGUAGE_AWARENESS}`;

  let totalInput = 0;
  let totalOutput = 0;

  // First attempt: qwen-turbo (single try, then one escalation — keep within Edge Function wall-clock)
  const r1 = await callModel(apiKey, MODEL_TURBO, fullSystem, userContent, maxOutputTokens);
  totalInput += r1.inputTokens;
  totalOutput += r1.outputTokens;
  let parsed = tryParseJson(r1.text);

  if (parsed) {
    return { parsed, inputTokens: totalInput, outputTokens: totalOutput, model: MODEL_TURBO };
  }

  // One retry with format hint (same model, fast)
  const retryContent = `${userContent}\n\n[SYSTEM NOTE: Your previous response was not valid JSON. Respond ONLY with the JSON object, no markdown fences, no explanation.]`;
  const r2 = await callModel(apiKey, MODEL_TURBO, fullSystem, retryContent, maxOutputTokens);
  totalInput += r2.inputTokens;
  totalOutput += r2.outputTokens;
  parsed = tryParseJson(r2.text);

  if (parsed) {
    return { parsed, inputTokens: totalInput, outputTokens: totalOutput, model: MODEL_TURBO };
  }

  // Single escalation to qwen-plus (skip qwen-max to stay within timeout budget)
  const r3 = await callModel(apiKey, MODEL_PLUS, fullSystem, retryContent, maxOutputTokens);
  totalInput += r3.inputTokens;
  totalOutput += r3.outputTokens;
  parsed = tryParseJson(r3.text);

  if (parsed) {
    return { parsed, inputTokens: totalInput, outputTokens: totalOutput, model: MODEL_PLUS };
  }

  throw new Error('LLM_PARSE_ERROR: Failed to get valid JSON after retry and escalation');
}

async function callModel(
  apiKey: string,
  model: string,
  system: string,
  content: string,
  maxTokens: number,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000); // 20s per call (3 calls × 20s = 60s budget)

  try {
    const response = await fetch(`${DASHSCOPE_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Qwen API error ${response.status}: ${errText}`);
    }

    const json = await response.json();
    const text = json.choices?.[0]?.message?.content || '';
    const usage = json.usage || {};

    return {
      text,
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function tryParseJson(text: string): Record<string, unknown> | null {
  // Strip Qwen3 <think>...</think> reasoning blocks
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  try {
    const result = JSON.parse(cleaned);
    if (typeof result === 'object' && result !== null) {
      return result;
    }
  } catch {
    // parse failed
  }
  return null;
}
