import { useEffect, useRef, useState } from "react";
import { Loader2, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { SavedReplyThumbnail } from "@/components/SavedReplyThumbnail";
import { friendlySavedReplyError, useSavedReplyMutations, type ImageChange } from "@/hooks/useSavedReplies";
import {
  MESSAGE_MAX, normalizeKeywords, normalizeShortcut, validateImageFile, validateMessage, validateShortcut,
  type SavedReply,
} from "@/lib/savedReplies";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reply?: SavedReply | null;
}

export const SavedReplyDialog = ({ open, onOpenChange, reply }: Props) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { create, update } = useSavedReplyMutations();
  const [shortcut, setShortcut] = useState("");
  const [message, setMessage] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");
  const [image, setImage] = useState<ImageChange>("keep");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setShortcut(reply?.shortcut ?? "");
    setMessage(reply?.message ?? "");
    setKeywords(reply?.keywords ?? []);
    setKwInput("");
    setImage(reply ? "keep" : null);
    setErrors({});
  }, [open, reply]);

  useEffect(() => {
    if (!(image instanceof File)) { setImagePreview(null); return; }
    const url = URL.createObjectURL(image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const addKeywords = (raw: string) => {
    const parts = raw.split(",");
    setKeywords((k) => normalizeKeywords([...k, ...parts]));
    setKwInput("");
  };

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    const err = await validateImageFile(f);
    if (err) { setErrors((e) => ({ ...e, image: err })); return; }
    setErrors((e) => ({ ...e, image: null }));
    setImage(f);
  };

  const hasExistingImage = image === "keep" && !!reply?.image_path;

  const save = async () => {
    if (saving) return;
    const allKeywords = normalizeKeywords([...keywords, ...kwInput.split(",")]);
    const errs = { shortcut: validateShortcut(shortcut), message: validateMessage(message) };
    setErrors((e) => ({ ...e, ...errs }));
    if (errs.shortcut || errs.message || !user) return;
    setSaving(true);
    const input = { shortcut: normalizeShortcut(shortcut), message, keywords: allKeywords };
    try {
      if (reply) await update.mutateAsync({ reply, input, image });
      else await create.mutateAsync({ input, image: image instanceof File ? image : null, userId: user.id });
      toast.success(reply ? "Saved reply updated" : "Saved reply created");
      onOpenChange(false);
    } catch (e) {
      const msg = friendlySavedReplyError(e);
      if (msg === "This shortcut is already in use") setErrors((x) => ({ ...x, shortcut: msg }));
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const title = reply ? "Edit saved reply" : "New saved reply";
  const body = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sr-shortcut">Shortcut</Label>
        <Input id="sr-shortcut" value={shortcut} maxLength={60} onChange={(e) => setShortcut(e.target.value)}
          aria-invalid={!!errors.shortcut} placeholder="e.g. visa-price" />
        {errors.shortcut && <p className="text-xs text-destructive">{errors.shortcut}</p>}
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Label htmlFor="sr-message">Message</Label>
          <span className={`text-xs ${message.length > MESSAGE_MAX ? "text-destructive" : "text-muted-foreground"}`}>
            {message.length}/{MESSAGE_MAX}
          </span>
        </div>
        <Textarea id="sr-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
          aria-invalid={!!errors.message} />
        {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sr-keywords">Keywords</Label>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {keywords.map((k) => (
              <Badge key={k} variant="secondary" className="gap-1">
                {k}
                <button type="button" aria-label={`Remove keyword ${k}`} onClick={() => setKeywords((l) => l.filter((x) => x !== k))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <Input id="sr-keywords" value={kwInput} onChange={(e) => setKwInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addKeywords(kwInput); } }}
          onBlur={() => kwInput.trim() && addKeywords(kwInput)}
          placeholder="Type a keyword and press Enter" />
      </div>
      <div className="space-y-1.5">
        <Label>Picture (optional)</Label>
        <div className="flex items-center gap-3">
          {imagePreview ? (
            <img src={imagePreview} alt="Selected picture" className="h-16 w-16 rounded-md object-cover" />
          ) : hasExistingImage ? (
            <SavedReplyThumbnail path={reply!.image_path} className="h-16 w-16" />
          ) : (
            <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              {imagePreview || hasExistingImage ? "Replace" : "Add picture"}
            </Button>
            {(imagePreview || hasExistingImage) && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setImage(null)}>Remove</Button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        {errors.image && <p className="text-xs text-destructive">{errors.image}</p>}
      </div>
    </div>
  );

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {reply ? "Save changes" : "Save"}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
        <SheetContent side="bottom" className="h-[100dvh] flex flex-col">
          <SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription className="sr-only">{title}</SheetDescription></SheetHeader>
          <div className="flex-1 overflow-y-auto py-4">{body}</div>
          {footer}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription className="sr-only">{title}</DialogDescription></DialogHeader>
        {body}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
