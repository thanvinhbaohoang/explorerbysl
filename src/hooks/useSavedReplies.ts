import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extForMime, type SavedReply } from "@/lib/savedReplies";

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
        .select("*")
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

/** "keep" = unchanged, null = remove, File = new picture */
export type ImageChange = "keep" | null | File;

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
  if (error) console.warn("[saved-replies] could not remove object", path, error.message);
};

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

  const create = useMutation({
    mutationFn: async ({ input, image, userId }: { input: SavedReplyInput; image: File | null; userId: string }) => {
      const id = crypto.randomUUID();
      let path: string | null = null;
      if (image) path = await uploadImage(userId, id, image);
      const { error } = await supabase.from("saved_replies").insert({
        id,
        ...input,
        image_path: path,
        image_name: image ? image.name : null,
        image_mime_type: image ? image.type : null,
        image_size: image ? image.size : null,
      });
      if (error) {
        if (path) await removeObject(path);
        throw error;
      }
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ reply, input, image }: { reply: SavedReply; input: SavedReplyInput; image: ImageChange }) => {
      let newPath: string | null = null;
      const patch: Record<string, unknown> = { ...input };
      if (image instanceof File) {
        // Always keep pictures in the original creator's folder
        newPath = await uploadImage(reply.created_by, reply.id, image);
        Object.assign(patch, { image_path: newPath, image_name: image.name, image_mime_type: image.type, image_size: image.size });
      } else if (image === null) {
        Object.assign(patch, { image_path: null, image_name: null, image_mime_type: null, image_size: null });
      }
      const { data, error } = await supabase.from("saved_replies").update(patch).eq("id", reply.id).select("id");
      if (error || !data?.length) {
        if (newPath) await removeObject(newPath);
        throw error ?? new Error("This reply was deleted or you don't have permission to change it");
      }
      if (image !== "keep" && reply.image_path) {
        await removeObject(reply.image_path);
        qc.removeQueries({ queryKey: thumbKey(reply.image_path) });
      }
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (reply: SavedReply) => {
      const { data, error } = await supabase.from("saved_replies").delete().eq("id", reply.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("This reply was already deleted or you don't have permission");
      if (reply.image_path) {
        await removeObject(reply.image_path);
        qc.removeQueries({ queryKey: thumbKey(reply.image_path) });
      }
    },
    onSettled: invalidate,
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
export async function downloadSavedReplyImage(reply: SavedReply): Promise<File> {
  if (!reply.image_path || !reply.image_mime_type) throw new Error("No picture");
  const { data, error } = await supabase.storage.from(SAVED_REPLY_BUCKET).download(reply.image_path);
  if (error || !data) throw new Error(error?.message || "Picture not found");
  return new File([data], reply.image_name || `saved-reply.${extForMime(reply.image_mime_type)}`, {
    type: reply.image_mime_type,
  });
}
