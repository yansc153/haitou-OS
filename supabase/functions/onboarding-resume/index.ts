import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

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

  if (!file) {
    return err(400, 'BAD_REQUEST', 'No file provided');
  }

  if (file.size > MAX_FILE_SIZE) {
    return err(400, 'BAD_REQUEST', 'File exceeds 10MB limit');
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return err(400, 'BAD_REQUEST', 'Only PDF, DOC, and DOCX files are accepted');
  }

  const serviceClient = getServiceClient();
  const storagePath = `resumes/${user!.id}/${Date.now()}_${file.name}`;

  // Upload to storage
  const { error: uploadError } = await serviceClient.storage
    .from('resumes')
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    return err(500, 'INTERNAL_ERROR', 'Failed to upload file');
  }

  // Create ResumeAsset record
  const { data: asset, error: assetError } = await serviceClient
    .from('resume_asset')
    .insert({
      user_id: user!.id,
      file_name: file.name,
      file_size_bytes: file.size,
      file_mime_type: file.type,
      storage_path: storagePath,
      upload_status: 'uploaded',
      parse_status: 'pending',
      is_primary: true,
    })
    .select()
    .single();

  if (assetError) {
    return err(500, 'INTERNAL_ERROR', 'Failed to create resume record');
  }

  // Update onboarding draft
  await serviceClient
    .from('onboarding_draft')
    .update({
      resume_asset_id: asset.id,
      resume_upload_status: 'uploaded',
    })
    .eq('user_id', user!.id);

  // Trigger stub parse (M1: minimal parse, real LLM parse in M5)
  // For now, mark as processing then immediately create a stub ProfileBaseline
  await serviceClient
    .from('resume_asset')
    .update({ parse_status: 'processing', upload_status: 'processing' })
    .eq('id', asset.id);

  // Stub: create minimal ProfileBaseline
  // Real implementation in M5 will use resume-parse + profile-extraction skills
  const { data: draft } = await serviceClient
    .from('onboarding_draft')
    .select('team_id')
    .eq('user_id', user!.id)
    .single();

  // We may not have a team yet at this point — that's OK
  // ProfileBaseline will be created with team_id once team exists
  // For now, just mark parse as complete
  await serviceClient
    .from('resume_asset')
    .update({ parse_status: 'parsed', upload_status: 'processed' })
    .eq('id', asset.id);

  await serviceClient
    .from('onboarding_draft')
    .update({ resume_upload_status: 'processed' })
    .eq('user_id', user!.id);

  return ok({ resume_asset_id: asset.id, status: 'processed' });
});
