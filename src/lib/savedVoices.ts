export interface SavedVoice {
  id: string;
  title: string;
  keywords: string[];
  audio_path: string;
  audio_mime_type: string;
  audio_size: number;
  duration_sec: number;
  created_by: string;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export const VOICE_MAX_BYTES = 5 * 1024 * 1024;
export const VOICE_MIN_SEC = 1;
export const VOICE_MAX_SEC = 120;
export type VoiceSourceType = "mp3" | "m4a" | "ogg" | "webm";

/** Detect the real audio container from magic bytes (never trust the extension). */
export function sniffAudioType(b: Uint8Array): VoiceSourceType | null {
  if (b.length >= 4 && b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return "ogg";
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "m4a";
  if (b.length >= 3 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return "mp3";
  if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "mp3";
  return null;
}

export function validateVoiceSize(size: number): string | null {
  if (size <= 0) return "The recording is empty";
  if (size > VOICE_MAX_BYTES) return "Recording must be 5 MB or smaller";
  return null;
}

export function validateVoiceDuration(sec: number): string | null {
  if (!Number.isFinite(sec) || sec < VOICE_MIN_SEC) return "Recording must be at least 1 second";
  if (sec > VOICE_MAX_SEC) return "Recording must be 2 minutes or shorter";
  return null;
}

export function matchesVoiceSearch(v: SavedVoice, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return v.title.toLowerCase().includes(q) || v.keywords.some((k) => k.toLowerCase().includes(q));
}

export function parseKeywords(input: string): string[] {
  return Array.from(new Set(input.split(",").map((k) => k.trim()).filter(Boolean))).slice(0, 20);
}

export async function sniffAudioFile(file: Blob): Promise<VoiceSourceType | null> {
  return sniffAudioType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
}

/** Decode audio to read its exact length in seconds. */
export async function probeDuration(file: Blob): Promise<number> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    return buf.duration;
  } finally {
    void ctx.close();
  }
}
