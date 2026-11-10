import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SmilePlus, Loader2, Reply } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { canReact, movedTooFar, reactionChoices } from '@/lib/messageReactions';
import type { Message } from '@/hooks/useChatMessages';

export function MessageReactionControl({ message, rows, react, children, pageId, latestCustomerTimestamp, ready, onReply }: {
  message: Message; children: ReactNode;
  rows: { message_id: string; actor_type: string; emoji: string | null }[];
  react: (message: Message, emoji: string) => Promise<boolean>;
  pageId?: string | null; latestCustomerTimestamp?: string | null; ready: boolean;
  onReply?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const start = useRef({ x: 0, y: 0 });
  const fired = useRef(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();
  const [now, setNow] = useState(Date.now());
  const cancel = () => { clearTimeout(timer.current); };
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => { cancel(); clearTimeout(resetTimer.current); clearInterval(interval); };
  }, []);
  const release = () => { cancel(); resetTimer.current = setTimeout(() => { fired.current = false; }, 0); };
  const eligible = ready && canReact(message, pageId, latestCustomerTimestamp, now);
  const reactions = rows.filter(row => row.message_id === message.id && row.emoji);
  const choices = reactionChoices(message.platform);
  return <div className={`group/reaction relative [&>div:first-child]:ml-0 [&>div:first-child]:mr-0 ${message.sender_type === 'employee' ? 'ml-12' : 'mr-12'}`} data-message-id={message.id}
    onPointerDown={e => {
      if ((!eligible && !onReply) || e.pointerType === 'mouse' || (e.target instanceof Element && e.target.closest('button,a,audio,video,input,img'))) return;
      cancel(); fired.current = false; start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => { fired.current = true; setOpen(true); }, 500);
    }}
    onPointerMove={e => { if (movedTooFar(start.current, e.clientX, e.clientY)) cancel(); }}
    onPointerUp={release} onPointerCancel={release} onPointerLeave={cancel} onContextMenu={e => { if (eligible && fired.current) e.preventDefault(); }}
    onClickCapture={e => { if (fired.current && e.target instanceof Node && e.currentTarget.contains(e.target)) { e.preventDefault(); e.stopPropagation(); fired.current = false; } }}>
    {children}
    {(eligible || onReply) && <Popover open={open} onOpenChange={setOpen}>
      <Tooltip><TooltipTrigger asChild><PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label="React to message" className="absolute right-1 top-1 h-8 w-8 bg-background opacity-100 md:opacity-0 md:group-hover/reaction:opacity-100 md:group-focus-within/reaction:opacity-100" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SmilePlus className="h-4 w-4" />}
        </Button>
      </PopoverTrigger></TooltipTrigger><TooltipContent>React to message</TooltipContent></Tooltip>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-2" align="end">
        {onReply && <Button variant="ghost" className="w-full justify-start mb-1" onClick={() => { onReply(); setOpen(false); }}><Reply className="h-4 w-4 mr-2" />Reply</Button>}
        {eligible && <div className="flex gap-1">{choices.map(choice => <Button key={choice.emoji} variant="ghost" size="icon" aria-label={choice.label} disabled={busy} aria-pressed={reactions.some(row => row.actor_type === 'staff' && row.emoji === choice.emoji)} className="h-11 w-11 text-xl" onClick={async () => {
          setBusy(true); const success = await react(message, choice.emoji); setBusy(false); if (success) setOpen(false);
        }}>{choice.emoji}</Button>)}</div>}
      </PopoverContent>
    </Popover>}
    {onReply && <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" aria-label="Reply to message" onClick={onReply} className="absolute right-10 top-1 h-8 w-8 bg-background opacity-100 md:opacity-0 md:group-hover/reaction:opacity-100 md:group-focus-within/reaction:opacity-100"><Reply className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Reply to message</TooltipContent></Tooltip>}
    {reactions.length > 0 && <div className="mt-1 flex flex-wrap gap-1" aria-live="polite">{reactions.map(row => <span key={row.actor_type} className="inline-flex items-center gap-1 rounded border bg-muted px-2 py-0.5 text-xs" title={row.actor_type === 'staff' ? 'Team reaction' : 'Customer reaction'}>{row.emoji} {row.actor_type === 'staff' ? 'Team' : 'Customer'}</span>)}</div>}
  </div>;
}