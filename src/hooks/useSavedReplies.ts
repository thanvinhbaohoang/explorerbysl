import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extForMime, getSavedReplyImages, loadSavedReplyFiles, validateImageFile, validatePictureCount,
  type SavedReply, type SavedReplyImage, type SavedReplyPicture } from "@/lib/savedReplies";

export const SAVED_REPLIES_KEY = ["saved-replies"] as const;
export const SAVED_REPLY_BUCKET = "saved-reply-media";
export const thumbKey = (path: string) => ["saved-reply-thumb", path] as const;

export function useSavedRepliesList(enabled: boolean) {
  return useQuery({
    queryKey: SAVED_REPLIES_KEY,
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<SavedReply[]> => {
      const { data, error } = await supabase
        .from("saved_replies")
        .select("*, images:saved_reply_images(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedReply[];
    },
  });
}

export interface SavedReplyInput {
  shortcut: string;
  message: string;
  keywords: string[];
}

const uploadImage = async (folderOwner: string, replyId: string, file: File) => {
  const path = `${folderOwner}/${replyId}/${crypto.randomUUID()}.${extForMime(file.type)}`;
  const { error } = await supabase.storage
    .from(SAVED_REPLY_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Picture upload failed: ${error.message}`);
  return path;
};

const removeObject = async (path: string) => {
  const { error } = await supabase.storage.from(SAVED_REPLY_BUCKET).remove([path]);
  if (error) throw new Error(`Picture cleanup failed: ${error.message}`);
};

/** Failures remain queued, and never roll back an already successful save. */
export async function drainSavedReplyCleanup() {
  const { data, error } = await supabase.rpc("claim_saved_reply_cleanup");
  if (error) throw error;
  let failed = false;
  for (const path of data ?? []) {
    try {
      await removeObject(path);
      const { error: completeError } = await supabase.rpc("complete_saved_reply_cleanup", { p_path: path });
      if (completeError) throw completeError;
    } catch (cleanupError) {
      failed = true;
      console.warn("[saved-replies] cleanup pending", cleanupError);
    }
  }
  if (failed) throw new Error("Some removed pictures are awaiting cleanup");
}

const imagePayload = (image: SavedReplyImage) => ({
  path: image.image_path, name: image.image_name, mime_type: image.image_mime_type, size: image.image_size,
});

/** Only new uploads are undone on failure; retained business objects are never touched. */
async function savePictures(owner: string, id: string, pictures: SavedReplyPicture[], save: (images: SavedReplyImage[]) => Promise<void>) {
  const countError = validatePictureCount(pictures.length);
  if (countError) throw new Error(countError);
  const uploaded: string[] = [];
  try {
    const images: SavedReplyImage[] = [];
    for (const [position, picture] of pictures.entries()) {
      if (picture instanceof File) {
        const invalid = await validateImageFile(picture);
        if (invalid) throw new Error(invalid);
        const path = await uploadImage(owner, id, picture);
        uploaded.push(path);
        images.push({ image_path: path, image_name: picture.name, image_mime_type: picture.type,
          image_size: picture.size, position });
      } else images.push({ ...picture, position });
    }
    await save(images);
  } catch (error) {
    for (const path of uploaded) {
      try { await removeObject(path); }
      catch (cleanupError) { console.warn("[saved-replies] failed upload cleanup", cleanupError); }
    }
    throw error;
  }
}

export function friendlySavedReplyError(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === "23505") return "This shortcut is already in use";
  if (err?.code === "42501" || /row-level security|permission/i.test(err?.message ?? ""))
    return "You don't have permission to change this reply";
  return err?.message || "Something went wrong";
}

export function useSavedReplyMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: SAVED_REPLIES_KEY });
  const afterSave = async () => {
    await invalidate();
    try { await drainSavedReplyCleanup(); }
    catch (error) { console.warn("[saved-replies] cleanup pending", error); }
  };
  const invalidateImages = (reply: SavedReply) => {
    for (const image of getSavedReplyImages(reply)) qc.removeQueries({ queryKey: thumbKey(image.image_path) });
  };

  const create = useMutation({
    mutationFn: async ({ input, pictures, userId }: { input: SavedReplyInput; pictures: SavedReplyPicture[]; userId: string }) => {
      const id = crypto.randomUUID();
      await savePictures(userId, id, pictures, async (images) => {
        const { error } = await supabase.rpc("create_saved_reply", {
          p_id: id, p_shortcut: input.shortcut, p_message: input.message, p_keywords: input.keywords,
          p_images: images.map(imagePayload),
        });
        if (error) throw error;
      });
    },
    onSuccess: afterSave,
  });

  const update = useMutation({
    mutationFn: async ({ reply, input, pictures }: { reply: SavedReply; input: SavedReplyInput; pictures: SavedReplyPicture[] }) => {
      await savePictures(reply.created_by, reply.id, pictures, async (images) => {
        const { error } = await supabase.rpc("update_saved_reply", {
          p_id: reply.id, p_shortcut: input.shortcut, p_message: input.message, p_keywords: input.keywords,
          p_images: images.map(imagePayload),
        });
        if (error) throw error;
      });
      invalidateImages(reply);
    },
    onSuccess: afterSave,
  });

  const remove = useMutation({
    mutationFn: async (reply: SavedReply) => {
      const { error } = await supabase.rpc("delete_saved_reply", { p_id: reply.id });
      if (error) throw error;
      invalidateImages(reply);
    },
    onSuccess: afterSave,
    onError: invalidate,
  });

  return { create, update, remove };
}

export async function recordSavedReplyUse(id: string) {
  try {
    const { error } = await supabase.rpc("record_saved_reply_use", { p_id: id });
    if (error) console.warn("[saved-replies] usage tracking failed", error.message);
  } catch (e) {
    console.warn("[saved-replies] usage tracking failed", e);
  }
}

/** Fresh authenticated download → File, for the composer. */
async function downloadSavedReplyImage(reply: SavedReplyImage): Promise<File> {
  const { data, error } = await supabase.storage.from(SAVED_REPLY_BUCKET).download(reply.image_path);
  if (error || !data) throw new Error(error?.message || "Picture not found");
  return new File([data], reply.image_name || `saved-reply.${extForMime(reply.image_mime_type)}`, {
    type: reply.image_mime_type,
  });
}

export async function downloadSavedReplyImages(reply: SavedReply): Promise<File[]> {
  // Re-read pictures so a stale list cannot silently insert an incomplete album.
  const { data, error } = await supabase.from("saved_replies")
    .select("*, images:saved_reply_images(*)").eq("id", reply.id).single();
  if (error || !data) throw new Error(error?.message || "This reply was deleted");
  return loadSavedReplyFiles(getSavedReplyImages(data as SavedReply), downloadSavedReplyImage);
}
