import { useMemo, useRef, useState } from "react";
import { MessageSquareText, Plus, Search, X, MoreVertical, Pencil, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useSavedRepliesList, useSavedReplyMutations, friendlySavedReplyError } from "@/hooks/useSavedReplies";
import { SavedReplyThumbnail } from "@/components/SavedReplyThumbnail";
import { SavedReplyDialog } from "@/components/SavedReplyDialog";
import { matchesSearch, sortReplies, type SavedReply, type SavedReplySort } from "@/lib/savedReplies";

interface Props {
  /** True when the Messenger 24h window has expired: browsing allowed, using disabled. */
  useDisabled: boolean;
  /** Load the reply into the composer. Resolve true when the draft was populated. Never sends. */
  onSelect: (reply: SavedReply) => Promise<boolean>;
  /** Called after the panel closes so the composer can take focus back. */
  onClosed?: () => void;
}

export const SavedRepliesPanel = ({ useDisabled, onSelect, onClosed }: Props) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SavedReplySort>("frequent");
  const [editing, setEditing] = useState<SavedReply | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<SavedReply | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch, isFetching } = useSavedRepliesList(open);
  const { remove } = useSavedReplyMutations();

  const results = useMemo(
    () => sortReplies((data ?? []).filter((r) => matchesSearch(r, query)), sort),
    [data, query, sort],
  );

  const setOpenAndRefresh = (o: boolean) => {
    setOpen(o);
    if (o) void refetch();
    else onClosed?.();
  };

  const canManage = (r: SavedReply) => isAdmin || r.created_by === user?.id;

  const choose = async (r: SavedReply) => {
    if (useDisabled || busyId) return;
    setBusyId(r.id);
    try {
      const ok = await onSelect(r);
      if (ok) setOpenAndRefresh(false);
    } finally {
      setBusyId(null);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-sr-item]") ?? []);
    if (!items.length) return;
    e.preventDefault();
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
    items[idx === -1 ? 0 : next]?.focus();
  };

  const content = (
    <div className="flex flex-col min-h-0 h-full" onKeyDown={onListKeyDown}>
      {!isMobile && (
        <div className="flex items-center justify-between px-3 pt-3">
          <h2 className="text-sm font-semibold">Saved replies</h2>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add new
          </Button>
        </div>
      )}
      <div className="flex gap-2 px-3 py-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); listRef.current?.querySelector<HTMLElement>("[data-sr-item]")?.focus(); } }}
            placeholder="Search replies…" aria-label="Search saved replies" className="pl-8 pr-8 h-9" />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); searchRef.current?.focus(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SavedReplySort)}>
          <SelectTrigger className="w-[150px] h-9" aria-label="Sort saved replies"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="frequent">Frequently used</SelectItem>
            <SelectItem value="recent_used">Recently used</SelectItem>
            <SelectItem value="recent_created">Recently created</SelectItem>
            <SelectItem value="alpha">Alphabetical</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {useDisabled && (
        <div className="mx-3 mb-2 flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Messaging is unavailable — the 24-hour Messenger window has expired.
        </div>
      )}
      <div ref={listRef} className={`overflow-y-auto px-1 pb-2 ${isMobile ? "flex-1" : "max-h-[360px]"}`} role="list">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-2 py-2">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-3 w-4/5" /></div>
            </div>
          ))
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">Unable to load saved replies</p>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Retry
            </Button>
          </div>
        ) : (data ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">No saved replies yet</p>
            <Button size="sm" variant="outline" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Add new
            </Button>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">No saved replies match your search</p>
            <Button size="sm" variant="ghost" onClick={() => setQuery("")}>Clear search</Button>
          </div>
        ) : (
          results.map((r) => (
            <div key={r.id} role="listitem" className="group flex items-start gap-1 rounded-md hover:bg-accent">
              <button type="button" data-sr-item disabled={useDisabled || !!busyId}
                onClick={() => choose(r)}
                aria-label={`Use reply ${r.shortcut}`}
                className="flex flex-1 min-w-0 items-start gap-3 px-2 py-2 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]">
                <SavedReplyThumbnail path={r.image_path} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{r.shortcut}</span>
                    {busyId === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground whitespace-pre-line">{r.message}</p>
                  {r.keywords.length > 0 && (
                    <p className="truncate text-[11px] text-muted-foreground/80 mt-0.5">{r.keywords.join(" · ")}</p>
                  )}
                </div>
              </button>
              {canManage(r) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 mt-2 shrink-0" aria-label={`Actions for ${r.shortcut}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditing(r); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4 mr-2" />Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(r)}>
                      <Trash2 className="h-4 w-4 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const trigger = (
    <Button variant="outline" size="icon" aria-label="Saved replies" aria-haspopup="dialog" aria-expanded={open}
      onClick={isMobile ? () => setOpenAndRefresh(true) : undefined}>
      <MessageSquareText className="h-4 w-4" />
    </Button>
  );

  return (
    <>
      {isMobile ? (
        <>
          <Tooltip><TooltipTrigger asChild>{trigger}</TooltipTrigger><TooltipContent>Saved replies</TooltipContent></Tooltip>
          <Sheet open={open} onOpenChange={setOpenAndRefresh}>
            <SheetContent side="bottom" className="h-[80dvh] flex flex-col p-0 gap-0">
              <SheetHeader className="flex-row items-center justify-between space-y-0 px-3 pt-4 pr-12">
                <SheetTitle className="text-base">Saved replies</SheetTitle>
                <SheetDescription className="sr-only">Search and choose a saved reply</SheetDescription>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Add new
                </Button>
              </SheetHeader>
              {content}
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpenAndRefresh}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Saved replies</TooltipContent>
          </Tooltip>
          <PopoverContent side="top" align="start" sideOffset={8} collisionPadding={16}
            className="w-[420px] max-w-[calc(100vw-2rem)] p-0" role="dialog" aria-label="Saved replies"
            onCloseAutoFocus={(e) => { e.preventDefault(); onClosed?.(); }}>
            {content}
          </PopoverContent>
        </Popover>
      )}

      <SavedReplyDialog open={dialogOpen} onOpenChange={setDialogOpen} reply={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this saved reply?</AlertDialogTitle>
            <AlertDialogDescription>“{toDelete?.shortcut}” will be removed for everyone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const r = toDelete; setToDelete(null);
                if (!r) return;
                try { await remove.mutateAsync(r); toast.success("Saved reply deleted"); }
                catch (e) { toast.error(friendlySavedReplyError(e)); }
              }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
