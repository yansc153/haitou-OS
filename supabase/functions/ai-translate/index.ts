import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { text, target_lang } = await req.json();
  if (!text || !target_lang) return err(400, 'BAD_REQUEST', 'text and target_lang required');

  const apiKey = Deno.env.get('DASHSCOPE_API_KEY');
  if (!apiKey) return err(500, 'CONFIG_ERROR', 'Translation service not configured');

  try {
    const resp = await fetch(`${DASHSCOPE_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages: [
          { role: 'system', content: `You are a professional translator. Translate the following text to ${target_lang === 'zh' ? 'Simplified Chinese (简体中文)' : 'English'}. Preserve formatting (bullet points, paragraphs). Output ONLY the translation, no explanation.` },
          { role: 'user', content: text.slice(0, 4000) },
        ],
        max_tokens: 2000,
      }),
    });

    const data = await resp.json();
    const translated = data.choices?.[0]?.message?.content?.trim();
    if (!translated) return err(500, 'TRANSLATE_FAILED', 'No translation returned');

    return ok({ translated_text: translated });
  } catch (e) {
    return err(500, 'TRANSLATE_ERROR', (e as Error).message);
  }
});
