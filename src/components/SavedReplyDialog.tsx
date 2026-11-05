import { useEffect, useRef, useState } from "react";
import { Loader2, X, ImagePlus, ArrowLeft, ArrowRight, RefreshCw, Trash2 } from "lucide-react";
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
import { friendlySavedReplyError, useSavedReplyMutations, type SavedReplyInput } from "@/hooks/useSavedReplies";
import {
  MESSAGE_MAX, normalizeKeywords, normalizeShortcut, validateImageFile, validateMessage, validateShortcut,
  getSavedReplyImages, movePicture, validatePictureCount, PICTURE_MAX, type SavedReply, type SavedReplyPicture,
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
  const [pictures, setPictures] = useState<SavedReplyPicture[]>([]);
  const [picking, setPicking] = useState(false);
  const replaceIndex = useRef<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setShortcut(reply?.shortcut ?? "");
    setMessage(reply?.message ?? "");
    setKeywords(reply?.keywords ?? []);
    setKwInput("");
    setPictures(reply ? getSavedReplyImages(reply) : []);
    setErrors({});
  }, [open, reply]);

  const addKeywords = (raw: string) => {
    const parts = raw.split(",");
    setKeywords((k) => normalizeKeywords([...k, ...parts]));
    setKwInput("");
  };

  const pickFiles = async (files: File[]) => {
    if (!files.length || saving || picking) return;
    const index = replaceIndex.current;
    setPicking(true);
    try {
      const countError = validatePictureCount(index === null ? pictures.length + files.length : pictures.length);
      if (countError) { setErrors((e) => ({ ...e, image: countError })); return; }
      for (const file of files) {
        const err = await validateImageFile(file);
        if (err) { setErrors((e) => ({ ...e, image: err })); return; }
      }
      setErrors((e) => ({ ...e, image: null }));
      setPictures((current) => index === null ? [...current, ...files] : current.map((p, i) => i === index ? files[0] : p));
    } finally { setPicking(false); }
  };

  const save = async () => {
    if (saving) return;
    const allKeywords = normalizeKeywords([...keywords, ...kwInput.split(",")]);
    const errs = { shortcut: validateShortcut(shortcut), message: validateMessage(message) };
    setErrors((e) => ({ ...e, ...errs }));
    if (errs.shortcut || errs.message || !user) return;
    setSaving(true);
    const input: SavedReplyInput = { shortcut: normalizeShortcut(shortcut), message, keywords: allKeywords };
    try {
      if (reply) await update.mutateAsync({ reply, input, pictures });
      else await create.mutateAsync({ input, pictures, userId: user.id });
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
        <Input id="sr-shortcut" value={shortcut} maxLength={60} disabled={saving || picking} onChange={(e) => setShortcut(e.target.value)}
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
        <Textarea id="sr-message" value={message} disabled={saving || picking} onChange={(e) => setMessage(e.target.value)} rows={5}
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
                <Button type="button" variant="ghost" size="icon" className="h-4 w-4" disabled={saving || picking} aria-label={`Remove keyword ${k}`} onClick={() => setKeywords((l) => l.filter((x) => x !== k))}>
                  <X className="h-3 w-3" />
                </Button>
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
        <div className="flex items-center justify-between">
          <Label>Pictures (optional)</Label>
          <span className="text-xs text-muted-foreground">{pictures.length} / {PICTURE_MAX} pictures</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {pictures.map((picture, index) => (
            <div key={picture instanceof File ? `${picture.name}-${index}` : picture.image_path} className="min-w-0 space-y-1">
              <PicturePreview picture={picture} />
              <div className="flex justify-between gap-0.5">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Move left"
                  aria-label={`Move picture ${index + 1} left`} disabled={index === 0 || saving || picking}
                  onClick={() => setPictures((p) => movePicture(p, index, index - 1))}><ArrowLeft className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Move right"
                  aria-label={`Move picture ${index + 1} right`} disabled={index === pictures.length - 1 || saving || picking}
                  onClick={() => setPictures((p) => movePicture(p, index, index + 1))}><ArrowRight className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Replace picture"
                  aria-label={`Replace picture ${index + 1}`} disabled={saving || picking}
                  onClick={() => { replaceIndex.current = index; if (fileRef.current) { fileRef.current.multiple = false; fileRef.current.click(); } }}><RefreshCw className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Remove picture"
                  aria-label={`Remove picture ${index + 1}`} disabled={saving || picking}
                  onClick={() => setPictures((p) => p.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" disabled={pictures.length >= PICTURE_MAX || saving || picking}
          onClick={() => { replaceIndex.current = null; if (fileRef.current) { fileRef.current.multiple = true; fileRef.current.click(); } }}>
          <ImagePlus className="h-4 w-4 mr-2" />Add pictures
        </Button>
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { void pickFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        {errors.image && <p className="text-xs text-destructive">{errors.image}</p>}
      </div>
    </div>
  );

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || picking}>Cancel</Button>
      <Button onClick={save} disabled={saving || picking}>
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

const PicturePreview = ({ picture }: { picture: SavedReplyPicture }) => {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!(picture instanceof File)) { setPreview(null); return; }
    const url = URL.createObjectURL(picture);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [picture]);
  return picture instanceof File ? (
    <div className="aspect-square w-full overflow-hidden rounded-md bg-muted">
      {preview && <img src={preview} alt={picture.name} className="h-full w-full object-cover" />}
    </div>
  ) : <SavedReplyThumbnail path={picture.image_path} className="aspect-square h-auto w-full" />;
};
