import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

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

  // Done — file uploaded and saved. Parsing happens at activation (Step 4).
  return ok({
    resume_asset_id: asset.id,
    status: 'uploaded',
    file_name: safeName,
  });
});
