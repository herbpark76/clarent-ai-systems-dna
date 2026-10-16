import { supabase } from './supabase';

export const BUCKET = 'learner-uploads';
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES = 5;
export const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf'];

export interface AttachmentRow {
  id: string;
  learner_id: string;
  progress_id: string | null;
  journal_entry_id: string | null;
  file_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface PendingFile {
  file: File;
  previewUrl: string;
  error?: string;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

export function buildPath(learnerId: string, folderId: string, fileName: string): string {
  return `${learnerId}/${folderId}/${sanitizeFileName(fileName)}`;
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Only PNG, JPG, GIF, WebP, and PDF files are allowed.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'File must be 10 MB or smaller.';
  }
  return null;
}

export async function uploadFile(
  learnerId: string,
  folderId: string,
  file: File,
): Promise<{ path: string; fileName: string; mimeType: string; sizeBytes: number } | null> {
  const filePath = buildPath(learnerId, folderId, file.name);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { contentType: file.type, upsert: false });
  if (error) return null;
  return { path: filePath, fileName: file.name, mimeType: file.type, sizeBytes: file.size };
}

export async function createAttachmentRecord(
  learnerId: string,
  progressId: string | null,
  journalEntryId: string | null,
  uploaded: { path: string; fileName: string; mimeType: string; sizeBytes: number },
): Promise<AttachmentRow | null> {
  const { data, error } = await supabase.from('lp_attachments').insert({
    learner_id: learnerId,
    progress_id: progressId,
    journal_entry_id: journalEntryId,
    file_path: uploaded.path,
    file_name: uploaded.fileName,
    mime_type: uploaded.mimeType,
    size_bytes: uploaded.sizeBytes,
  }).select('*').single();
  if (error) return null;
  return data as AttachmentRow;
}

export async function deleteAttachment(attachment: AttachmentRow): Promise<boolean> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([attachment.file_path]);
  if (storageError) return false;
  const { error: dbError } = await supabase
    .from('lp_attachments')
    .delete()
    .eq('id', attachment.id);
  return !dbError;
}

export async function fetchAttachments(progressIds: string[]): Promise<AttachmentRow[]> {
  if (progressIds.length === 0) return [];
  const { data, error } = await supabase
    .from('lp_attachments')
    .select('*')
    .in('progress_id', progressIds);
  if (error) return [];
  return (data || []) as AttachmentRow[];
}

export async function fetchAttachmentsByJournalIds(journalEntryIds: string[]): Promise<AttachmentRow[]> {
  if (journalEntryIds.length === 0) return [];
  const { data, error } = await supabase
    .from('lp_attachments')
    .select('*')
    .in('journal_entry_id', journalEntryIds);
  if (error) return [];
  return (data || []) as AttachmentRow[];
}

export async function fetchAttachmentsByLearner(learnerId: string): Promise<AttachmentRow[]> {
  const { data, error } = await supabase
    .from('lp_attachments')
    .select('*')
    .eq('learner_id', learnerId);
  if (error) return [];
  return (data || []) as AttachmentRow[];
}

export async function getSignedUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600);
  if (error) return null;
  return data.signedUrl;
}
