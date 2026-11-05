import { useMemo, useState } from "react";
import { AudioLines, Plus, Search, Pencil, Trash2, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useSavedVoicesList, useSavedVoiceMutations, downloadSavedVoice, friendlySavedVoiceError } from "@/hooks/useSavedVoices";
import { SavedVoiceDialog } from "@/components/SavedVoiceDialog";
import { matchesVoiceSearch, type SavedVoice } from "@/lib/savedVoices";

interface Props {
  useDisabled: boolean;
  /** Load into the voice composer. Resolve true when loaded. Never sends. */
  onSelect: (voice: SavedVoice) => Promise<boolean>;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export const SavedVoicePanel = ({ useDisabled, onSelect }: Props) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<SavedVoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<SavedVoice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const { data, isLoading, isError, refetch } = useSavedVoicesList(open);
  const { remove } = useSavedVoiceMutations();
  const results = useMemo(() => (data ?? []).filter((v) => matchesVoiceSearch(v, query)), [data, query]);

  const preview = async (v: SavedVoice) => {
    try { setPlaying({ id: v.id, url: URL.createObjectURL(await downloadSavedVoice(v)) }); }
    catch (e) { toast.error(friendlySavedVoiceError(e)); }
  };
  const choose = async (v: SavedVoice) => {
    if (useDisabled) return;
    setBusyId(v.id);
    try { if (await onSelect(v)) setOpen(false); } finally { setBusyId(null); }
  };

  const body = (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search saved voice" placeholder="Search title or keyword" className="pl-8"
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button size="icon" variant="outline" aria-label="New saved voice" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-y-auto max-h-[50vh] space-y-1" role="list">
        {isLoading && <p className="text-sm text-muted-foreground p-2">Loading…</p>}
        {isError && <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>}
        {!isLoading && !results.length && <p className="text-sm text-muted-foreground p-2">No saved voice messages</p>}
        {results.map((v) => {
          const canEdit = v.created_by === user?.id || isAdmin;
          return (
            <div key={v.id} role="listitem" className="rounded-md border p-2 space-y-1">
              <div className="flex items-center gap-2">
                <button type="button" className="flex-1 text-left min-w-0 disabled:opacity-50" disabled={useDisabled || busyId === v.id}
                  onClick={() => choose(v)} aria-label={`Use ${v.title}`}>
                  <div className="text-sm font-medium truncate">{v.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{fmt(v.duration_sec)} · {v.keywords.join(", ")}</div>
                </button>
                {busyId === v.id && <Loader2 className="h-4 w-4 animate-spin" />}
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Preview ${v.title}`} onClick={() => preview(v)}>
                  <Play className="h-4 w-4" /></Button>
                {canEdit && <>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Edit ${v.title}`}
                    onClick={() => { setEditing(v); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Delete ${v.title}`}
                    onClick={() => setToDelete(v)}><Trash2 className="h-4 w-4" /></Button>
                </>}
              </div>
              {playing?.id === v.id && <audio controls autoPlay src={playing.url} className="w-full h-8" />}
            </div>
          );
        })}
      </div>
    </div>
  );

  const trigger = (
    <Button variant="outline" size="icon" aria-label="Saved Voice" onClick={isMobile ? () => setOpen(true) : undefined}>
      <AudioLines className="h-4 w-4" />
    </Button>
  );

  return (
    <>
      {isMobile ? (
        <>
          <Tooltip><TooltipTrigger asChild>{trigger}</TooltipTrigger><TooltipContent>Saved Voice</TooltipContent></Tooltip>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="bottom" className="max-h-[85dvh]">
              <SheetHeader><SheetTitle>Saved Voice</SheetTitle>
                <SheetDescription>Choose one to load it into the voice message. It won't send until you press Send.</SheetDescription></SheetHeader>
              <div className="mt-3">{body}</div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip><TooltipTrigger asChild><PopoverTrigger asChild>{trigger}</PopoverTrigger></TooltipTrigger>
            <TooltipContent>Saved Voice</TooltipContent></Tooltip>
          <PopoverContent align="start" side="top" className="w-96">
            <div className="text-sm font-semibold mb-2">Saved Voice</div>{body}
          </PopoverContent>
        </Popover>
      )}
      <SavedVoiceDialog open={dialogOpen} onOpenChange={setDialogOpen} voice={editing} />
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete saved voice?</AlertDialogTitle>
            <AlertDialogDescription>"{toDelete?.title}" will be removed for everyone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!toDelete) return;
              try { await remove.mutateAsync(toDelete); toast.success("Deleted"); } catch (e) { toast.error(friendlySavedVoiceError(e)); }
              setToDelete(null);
            }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
