import { useEffect, useRef, useState } from "react";
import { Mic, Square, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { prepareVoice, useSavedVoiceMutations, friendlySavedVoiceError, downloadSavedVoice } from "@/hooks/useSavedVoices";
import { parseKeywords, type SavedVoice } from "@/lib/savedVoices";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; voice: SavedVoice | null }

export const SavedVoiceDialog = ({ open, onOpenChange, voice }: Props) => {
  const { user } = useAuth();
  const { create, update } = useSavedVoiceMutations();
  const [title, setTitle] = useState("");
  const [keywords, setKeywords] = useState("");
  const [audio, setAudio] = useState<{ file: File; duration: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(voice?.title ?? ""); setKeywords(voice?.keywords.join(", ") ?? ""); setAudio(null);
    setPreviewUrl(null);
    if (voice) downloadSavedVoice(voice).then((f) => setPreviewUrl(URL.createObjectURL(f))).catch(() => {});
  }, [open, voice]);

  const accept = async (blob: Blob) => {
    setPreparing(true);
    try {
      const prepared = await prepareVoice(blob);
      setAudio(prepared);
      setPreviewUrl(URL.createObjectURL(prepared.file));
    } catch (e) {
      toast.error(friendlySavedVoiceError(e));
    } finally { setPreparing(false); }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); void accept(new Blob(chunks, { type: rec.mimeType })); };
      rec.start(250); recRef.current = rec; setRecording(true);
    } catch { toast.error("Could not access microphone"); }
  };
  const stopRec = () => { recRef.current?.stop(); recRef.current = null; setRecording(false); };

  const busy = create.isPending || update.isPending || preparing || recording;
  const save = async () => {
    if (!user) return;
    const input = { title: title.trim(), keywords: parseKeywords(keywords), audio };
    if (!input.title) return toast.error("Add a title");
    try {
      if (voice) await update.mutateAsync({ voice, input });
      else await create.mutateAsync({ input, userId: user.id });
      toast.success("Saved voice stored");
      onOpenChange(false);
    } catch (e) { toast.error(friendlySavedVoiceError(e)); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{voice ? "Edit saved voice" : "New saved voice"}</DialogTitle>
          <DialogDescription>Record or upload once (MP3, M4A, OGG or WebM, up to 2 minutes).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="sv-title">Title</Label>
            <Input id="sv-title" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="sv-kw">Keywords (comma separated)</Label>
            <Input id="sv-kw" value={keywords} onChange={(e) => setKeywords(e.target.value)} /></div>
          <div className="flex gap-2">
            {recording ? (
              <Button type="button" variant="destructive" onClick={stopRec}><Square className="h-4 w-4 mr-2" />Stop</Button>
            ) : (
              <Button type="button" variant="outline" onClick={startRec} disabled={busy}><Mic className="h-4 w-4 mr-2" />Record</Button>
            )}
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload className="h-4 w-4 mr-2" />Upload
            </Button>
            <input ref={fileRef} type="file" className="hidden" data-testid="saved-voice-file"
              accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/ogg,audio/webm,.mp3,.m4a,.ogg,.webm"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void accept(f); }} />
            {preparing && <Loader2 className="h-4 w-4 animate-spin self-center" aria-label="Preparing" />}
          </div>
          {previewUrl && <audio controls src={previewUrl} className="w-full" aria-label="Preview" />}
          {audio && <p className="text-xs text-muted-foreground">Length: {audio.duration}s</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || (!voice && !audio)}>
            {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
