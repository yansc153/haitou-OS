/**
 * Supabase Storage helper — download files to temp directory for Playwright upload.
 */

import { writeFile, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Download a resume file from Supabase Storage and write to a temp file.
 * Returns the local file path (caller must clean up with cleanupTempFile).
 */
export async function downloadResumeToTemp(
  db: SupabaseClient,
  storagePath: string,
  fileName: string,
): Promise<string> {
  const { data, error } = await db.storage
    .from('resumes')
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Failed to download resume: ${error?.message || 'no data'}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const tempDir = await mkdtemp(join(tmpdir(), 'haitou-resume-'));
  const tempPath = join(tempDir, fileName);

  await writeFile(tempPath, buffer);
  return tempPath;
}

/**
 * Clean up a temp file and its parent directory after use.
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
    await rmdir(dirname(filePath));
  } catch {
    // Best effort cleanup
  }
}
