import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { extractResumeText } from '../_shared/pdf-extract.ts';
import { callHaiku } from '../_shared/llm.ts';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// From PROMPT_CONTRACT_SPEC.md § resume-parse
const RESUME_PARSE_PROMPT = `You are a resume parsing engine. Your job is to extract structured content from a resume document.

TASK:
Given the raw text content of a resume file, extract all identifiable sections in their original order. Preserve the distinction between section names and section content. Identify layout signals where visible.

INPUT:
You will receive:
- \`file_type\`: the original file format (pdf, docx, etc.)
- \`raw_text\`: the full extracted text content of the resume
- \`locale_hint\` (optional): a hint about the expected language/region

OUTPUT CONTRACT:
Return a JSON object with this exact schema:
{
  "parse_status": "success" | "partial" | "failed",
  "extracted_sections": [
    {
      "section_name": "<detected section heading or inferred category>",
      "raw_text": "<full text content of this section>",
      "order_index": <integer, 0-based>
    }
  ],
  "layout_hints": {
    "page_count": <number or null>,
    "bullet_usage": <boolean>,
    "column_hint": "single" | "double" | "mixed" | null,
    "likely_has_photo": <boolean>
  },
  "missing_or_uncertain_fields": ["<field names that could not be reliably extracted>"],
  "summary_text": "<1-2 sentence summary of what was extracted>"
}

QUALITY RULES:
- Preserve original section order as found in the document
- Use the actual section headings from the resume when present (e.g., "工作经历", "Education", "项目经验")
- When no explicit heading exists, infer a reasonable category name and prefix it with "[inferred]"
- If the document is largely unreadable or garbled, set parse_status to "failed" and explain in summary_text
- If some sections are clear but others are not, set parse_status to "partial"

FORBIDDEN:
- Do not invent content that is not in the raw text
- Do not rewrite or "improve" the resume text — extract it verbatim
- Do not merge distinct sections into one
- Do not guess contact information that is not explicitly present

FAILURE PROTOCOL:
If raw_text is empty or garbled beyond extraction, return:
{"parse_status": "failed", "extracted_sections": [], "layout_hints": null, "missing_or_uncertain_fields": ["all"], "summary_text": "Document content could not be extracted."}

Respond with a single JSON object matching the schema above. No markdown, no explanation, no preamble.`;

// From PROMPT_CONTRACT_SPEC.md § profile-extraction
const PROFILE_EXTRACTION_PROMPT = `You are a profile extraction engine for a job search automation system. Your job is to create a structured professional profile from parsed resume sections.

TASK:
Given the extracted sections of a resume, produce a comprehensive structured profile. Every field must be traceable to the input. Mark anything uncertain.

INPUT:
You will receive:
- \`extracted_sections\`: array of {section_name, raw_text, order_index} from resume-parse output
- \`locale_hint\` (optional): expected language/region

OUTPUT CONTRACT:
Return a JSON object with this exact schema:
{
  "full_name": "<string or null>",
  "contact_email": "<string or null>",
  "contact_phone": "<string or null>",
  "current_location": "<string or null>",
  "nationality": "<string or null>",
  "years_of_experience": <number or null>,
  "seniority_level": "<junior|mid|senior|lead|executive or null>",
  "primary_domain": "<string or null>",
  "headline_summary": "<1-2 sentence professional summary>",
  "experiences": [
    {
      "company_name": "<string>",
      "job_title": "<string>",
      "start_date": "<YYYY-MM or null>",
      "end_date": "<YYYY-MM or null>",
      "is_current": <boolean>,
      "location": "<string or null>",
      "description_summary": "<string or null>",
      "key_achievements": ["<string>"]
    }
  ],
  "education": [
    {
      "institution": "<string>",
      "degree": "<string or null>",
      "field_of_study": "<string or null>",
      "start_date": "<YYYY-MM or null>",
      "end_date": "<YYYY-MM or null>"
    }
  ],
  "skills": ["<string>"],
  "languages": [
    {
      "language": "<string>",
      "proficiency": "native|fluent|professional|conversational|basic"
    }
  ],
  "certifications": ["<string>"],
  "inferred_role_directions": ["<string>"],
  "capability_tags": ["<string>"],
  "capability_gaps": ["<string>"],
  "source_language": "zh" | "en" | "bilingual",
  "parse_confidence": "high" | "medium" | "low",
  "factual_gaps": ["<fields where data was ambiguous or missing>"],
  "summary_text": "<2-3 sentence summary of this person's professional profile>"
}

QUALITY RULES:
- Every field must come from the resume content. If not present, use null.
- years_of_experience: calculate from earliest start_date to latest end_date or today. If dates are missing, estimate cautiously or use null.
- seniority_level: infer from job titles and years. Be conservative — prefer null over a wrong guess.
- inferred_role_directions: based on the overall career trajectory, suggest 2-5 plausible job search directions.
- capability_tags: extract from skills sections, job descriptions, and education.
- parse_confidence: "high" if most fields are populated with clear data, "medium" if significant gaps exist, "low" if the resume was sparse or ambiguous.
- source_language: "zh" if primarily Chinese, "en" if primarily English, "bilingual" if substantial content in both.

FORBIDDEN:
- Do not invent work experience, education, or achievements not in the resume
- Do not fabricate contact information
- Do not assume seniority from company prestige alone — use job titles and scope
- Do not hallucinate skills not mentioned or clearly implied by the work description

FAILURE PROTOCOL:
If extracted_sections is empty or all sections are garbled, return a minimal profile with parse_confidence "low", all structured arrays empty, and factual_gaps listing all missing categories.

Respond with a single JSON object matching the schema above. No markdown, no explanation, no preamble.`;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return err(405, 'METHOD_NOT_ALLOWED', 'POST only');
  }

  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return err(400, 'BAD_REQUEST', 'No file provided');
  if (file.size > MAX_FILE_SIZE) return err(400, 'BAD_REQUEST', 'File exceeds 10MB limit');
  if (!ALLOWED_TYPES.includes(file.type)) {
    return err(400, 'BAD_REQUEST', 'Only PDF and DOCX files are accepted');
  }

  const serviceClient = getServiceClient();

  // Sanitize filename: strip path separators, keep only safe characters
  const safeName = file.name.replace(/[/\\:*?"<>|]/g, '_').replace(/\.\./g, '_');
  const storagePath = `resumes/${user!.id}/${Date.now()}_${safeName}`;

  // 1. Upload to storage
  const { error: uploadError } = await serviceClient.storage
    .from('resumes')
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) return err(500, 'INTERNAL_ERROR', 'Failed to upload file');

  // 1b. Unmark previous primary resume
  await serviceClient
    .from('resume_asset')
    .update({ is_primary: false })
    .eq('user_id', user!.id)
    .eq('is_primary', true);

  // 2. Create ResumeAsset record
  const { data: asset, error: assetError } = await serviceClient
    .from('resume_asset')
    .insert({
      user_id: user!.id,
      file_name: safeName,
      file_size_bytes: file.size,
      file_mime_type: file.type,
      storage_path: storagePath,
      upload_status: 'uploaded',
      parse_status: 'pending',
      is_primary: true,
    })
    .select()
    .single();

  if (assetError) return err(500, 'INTERNAL_ERROR', 'Failed to create resume record');

  // 3. Update onboarding draft
  await serviceClient
    .from('onboarding_draft')
    .update({ resume_asset_id: asset.id, resume_upload_status: 'uploaded' })
    .eq('user_id', user!.id);

  // 4. Mark as processing
  await serviceClient
    .from('resume_asset')
    .update({ parse_status: 'processing', upload_status: 'processing' })
    .eq('id', asset.id);

  try {
    // 5. Download file and extract text
    const { data: fileData, error: dlError } = await serviceClient.storage
      .from('resumes')
      .download(storagePath);

    if (dlError || !fileData) {
      throw new Error('Failed to download file from storage');
    }

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    const rawText = await extractResumeText(bytes, file.type);

    // 6. Step 1: resume-parse (Tier4 Haiku)
    const fileType = file.type.includes('pdf') ? 'pdf' : 'docx';
    const parseInput = JSON.stringify({
      file_type: fileType,
      raw_text: rawText.substring(0, 30000), // Limit to ~8K tokens
      locale_hint: 'auto',
    });

    const parseResult = await callHaiku(RESUME_PARSE_PROMPT, parseInput, 2048);
    const sections = parseResult.parsed;

    if (sections.parse_status === 'failed') {
      await serviceClient.from('resume_asset').update({ parse_status: 'failed' }).eq('id', asset.id);
      await serviceClient.from('onboarding_draft').update({
        resume_upload_status: 'processed',
        resume_parse_error_code: 'PARSE_FAILED',
        resume_parse_error_message: (sections.summary_text as string) || 'Resume content could not be extracted',
      }).eq('user_id', user!.id);
      return err(422, 'RESUME_PARSE_FAILED', (sections.summary_text as string) || '简历内容无法提取，请确认文件不是扫描版或图片版 PDF');
    }

    // 7. Step 2: profile-extraction (Tier4 Haiku)
    const extractInput = JSON.stringify({
      extracted_sections: sections.extracted_sections || [],
      locale_hint: 'auto',
    });

    const profileResult = await callHaiku(PROFILE_EXTRACTION_PROMPT, extractInput, 2048);
    const profile = profileResult.parsed;

    // 8. Mark parse complete
    await serviceClient
      .from('resume_asset')
      .update({ parse_status: 'parsed', upload_status: 'processed' })
      .eq('id', asset.id);

    // 9. Store parsed profile in onboarding_draft.answered_fields._parsed_profile
    const { data: draft } = await serviceClient
      .from('onboarding_draft')
      .select('answered_fields')
      .eq('user_id', user!.id)
      .single();

    const answeredFields = (draft?.answered_fields as Record<string, unknown>) || {};
    answeredFields._parsed_profile = profile;
    answeredFields._parsed_sections = sections;

    await serviceClient.from('onboarding_draft').update({
      answered_fields: answeredFields,
      resume_upload_status: 'processed',
      resume_parse_error_code: null,
      resume_parse_error_message: null,
    }).eq('user_id', user!.id);

    return ok({
      resume_asset_id: asset.id,
      status: 'processed',
      parse_confidence: profile.parse_confidence || 'low',
      summary: profile.headline_summary || profile.summary_text || null,
    });

  } catch (parseError) {
    // Parse failed — mark as failed but keep the uploaded file
    const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parse error';
    await serviceClient.from('resume_asset').update({ parse_status: 'failed' }).eq('id', asset.id);
    await serviceClient.from('onboarding_draft').update({
      resume_upload_status: 'processed',
      resume_parse_error_code: 'EXTRACTION_FAILED',
      resume_parse_error_message: errorMsg,
    }).eq('user_id', user!.id);

    // Still return OK — file uploaded successfully, parse failed gracefully
    return ok({ resume_asset_id: asset.id, status: 'parse_failed', error: errorMsg });
  }
});
