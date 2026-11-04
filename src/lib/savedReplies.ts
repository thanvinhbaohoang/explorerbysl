export interface SavedReply {
  id: string;
  shortcut: string;
  message: string;
  keywords: string[];
  image_path: string | null;
  image_name: string | null;
  image_mime_type: string | null;
  image_size: number | null;
  created_by: string;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SavedReplySort = "frequent" | "recent_used" | "recent_created" | "alpha";

export const SHORTCUT_MIN = 3;
export const SHORTCUT_MAX = 50;
export const MESSAGE_MAX = 1000;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const norm = (s: string) => s.normalize("NFC").toLocaleLowerCase();

export const normalizeShortcut = (s: string) => s.trim();

export function validateShortcut(raw: string): string | null {
  const s = normalizeShortcut(raw);
  if (s.length < SHORTCUT_MIN) return `Shortcut must be at least ${SHORTCUT_MIN} characters`;
  if (s.length > SHORTCUT_MAX) return `Shortcut must be at most ${SHORTCUT_MAX} characters`;
  return null;
}

export function validateMessage(raw: string): string | null {
  if (!raw.trim()) return "Message is required";
  if (raw.length > MESSAGE_MAX) return `Message must be at most ${MESSAGE_MAX} characters`;
  return null;
}

/** Trim, collapse inner whitespace, drop empties and case-insensitive duplicates. */
export function normalizeKeywords(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of list) {
    const v = k.replace(/\s+/g, " ").trim();
    if (!v) continue;
    const key = norm(v);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function matchesSearch(r: Pick<SavedReply, "shortcut" | "message" | "keywords">, q: string): boolean {
  const query = norm(q.trim());
  if (!query) return true;
  return (
    norm(r.shortcut).includes(query) ||
    norm(r.message).includes(query) ||
    r.keywords.some((k) => norm(k).includes(query))
  );
}

export function sortReplies<T extends SavedReply>(list: T[], sort: SavedReplySort): T[] {
  const arr = [...list];
  const t = (s: string | null) => (s ? new Date(s).getTime() : 0);
  switch (sort) {
    case "frequent":
      return arr.sort((a, b) => b.use_count - a.use_count || t(b.last_used_at) - t(a.last_used_at) || a.shortcut.localeCompare(b.shortcut));
    case "recent_used":
      return arr.sort((a, b) => t(b.last_used_at) - t(a.last_used_at) || a.shortcut.localeCompare(b.shortcut));
    case "recent_created":
      return arr.sort((a, b) => t(b.created_at) - t(a.created_at));
    case "alpha":
      return arr.sort((a, b) => a.shortcut.localeCompare(b.shortcut));
  }
}

export function hasDraft(d: { text: string; fileCount: number; hasRecordedAudio: boolean }): boolean {
  return d.text.trim().length > 0 || d.fileCount > 0 || d.hasRecordedAudio;
}

/** Detect real image type from magic bytes. */
export function sniffImageType(bytes: Uint8Array): (typeof ALLOWED_IMAGE_TYPES)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

export function validateImageMeta(type: string, size: number): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)) return "Only JPEG, PNG or WebP pictures are allowed";
  if (size < 1) return "The picture is empty";
  if (size > IMAGE_MAX_BYTES) return "The picture must be 10 MB or smaller";
  return null;
}

export async function validateImageFile(file: File): Promise<string | null> {
  const metaErr = validateImageMeta(file.type, file.size);
  if (metaErr) return metaErr;
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const real = sniffImageType(head);
  if (!real || real !== file.type) return "This file isn't a valid JPEG, PNG or WebP picture";
  return null;
}

export const extForMime = (m: string) => (m === "image/png" ? "png" : m === "image/webp" ? "webp" : "jpg");
