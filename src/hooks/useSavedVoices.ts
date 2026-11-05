import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { convertBlobToMp3 } from "@/lib/audio-conversion";
import { probeDuration, sniffAudioFile, validateVoiceDuration, validateVoiceSize, type SavedVoice } from "@/lib/savedVoices";

export const SAVED_VOICES_KEY = ["saved-voices"] as const;
export const SAVED_VOICE_BUCKET = "saved-voice-media";

export function useSavedVoicesList(enabled: boolean) {
  return useQuery({
    queryKey: SAVED_VOICES_KEY,
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<SavedVoice[]> => {
      const { data, error } = await supabase.from("saved_voices").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedVoice[];
    },
  });
}

/** Validate any allowed source, convert once to MP3 and return it with its exact length. */
export async function prepareVoice(source: Blob): Promise<{ file: File; duration: number }> {
  if (!(await sniffAudioFile(source))) throw new Error("Only MP3, M4A, OGG or WebM recordings are allowed");
  const mp3 = await convertBlobToMp3(source);
  const sizeError = validateVoiceSize(mp3.size);
  if (sizeError) throw new Error(sizeError);
  const duration = Math.round(await probeDuration(mp3));
  const durError = validateVoiceDuration(duration);
  if (durError) throw new Error(durError);
  return { file: mp3, duration };
}

export interface SavedVoiceInput { title: string; keywords: string[]; audio: { file: File; duration: number } | null }

const removeObject = (path: string) => supabase.storage.from(SAVED_VOICE_BUCKET).remove([path]);

export function useSavedVoiceMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: SAVED_VOICES_KEY });

  const upload = async (owner: string, id: string, file: File) => {
    const path = `${owner}/${id}/${crypto.randomUUID()}.mp3`;
    const { error } = await supabase.storage.from(SAVED_VOICE_BUCKET).upload(path, file, { contentType: "audio/mpeg", upsert: false });
    if (error) throw new Error(`Recording upload failed: ${error.message}`);
    return path;
  };

  const create = useMutation({
    mutationFn: async ({ input, userId }: { input: SavedVoiceInput; userId: string }) => {
      if (!input.audio) throw new Error("Record or upload a voice message first");
      const id = crypto.randomUUID();
      const path = await upload(userId, id, input.audio.file);
      const { error } = await supabase.rpc("create_saved_voice", {
        p_id: id, p_title: input.title, p_keywords: input.keywords, p_path: path,
        p_size: input.audio.file.size, p_duration: input.audio.duration,
      });
      if (error) { await removeObject(path); throw error; }
    },
    onSuccess: done,
  });

  const update = useMutation({
    mutationFn: async ({ voice, input }: { voice: SavedVoice; input: SavedVoiceInput }) => {
      let path = voice.audio_path, size = voice.audio_size, duration = voice.duration_sec, uploaded: string | null = null;
      if (input.audio) {
        uploaded = path = await upload(voice.created_by, voice.id, input.audio.file);
        size = input.audio.file.size; duration = input.audio.duration;
      }
      const { data: oldPath, error } = await supabase.rpc("update_saved_voice", {
        p_id: voice.id, p_title: input.title, p_keywords: input.keywords, p_path: path, p_size: size, p_duration: duration,
      });
      if (error) { if (uploaded) await removeObject(uploaded); throw error; }
      if (oldPath) await removeObject(oldPath as string);
    },
    onSuccess: done,
  });

  const remove = useMutation({
    mutationFn: async (voice: SavedVoice) => {
      const { data: path, error } = await supabase.rpc("delete_saved_voice", { p_id: voice.id });
      if (error) throw error;
      if (path) await removeObject(path as string);
    },
    onSuccess: done,
  });

  return { create, update, remove };
}

/** Private download via a short-lived signed link; returns a local copy for the composer. */
export async function downloadSavedVoice(voice: SavedVoice): Promise<File> {
  const { data, error } = await supabase.storage.from(SAVED_VOICE_BUCKET).createSignedUrl(voice.audio_path, 600);
  if (error || !data) throw new Error("Could not open this saved voice");
  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error("Could not download this saved voice");
  return new File([await res.blob()], `voice_${Date.now()}.mp3`, { type: "audio/mpeg" });
}

export async function recordSavedVoiceUse(id: string) {
  await supabase.rpc("record_saved_voice_use", { p_id: id });
}

export function friendlySavedVoiceError(e: unknown): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  if (m.includes("not authorized")) return "Only the creator or an admin can change this saved voice";
  if (m.includes("title")) return "Title must be 1–80 characters";
  return m || "Something went wrong";
}
