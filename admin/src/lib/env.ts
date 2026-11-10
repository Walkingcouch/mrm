// Public values (safe in the browser).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const LIMITS = {
  pdfBytes: 25 * 1024 * 1024,         // matches the 'content' bucket limit
  attachmentBytes: 15 * 1024 * 1024,  // matches the 'messages' bucket limit
  attachmentsPerMessage: 5,
  attachmentMimes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const,
};

export function publicFileUrl(bucket: 'content' | 'messages', path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
