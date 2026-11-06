import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SmilePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { canReact, movedTooFar, REACTION_CHOICES } from '@/lib/messageReactions';
import type { Message } from '@/hooks/useChatMessages';

export function MessageReactionControl({ message, rows, react, children }: {
  message: Message; children: ReactNode;
  rows: { message_id: string; actor_type: string; emoji: string | null }[];
  react: (message: Message, emoji: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const start = useRef({ x: 0, y: 0 });
  const fired = useRef(false);
  const cancel = () => { clearTimeout(timer.current); };
  useEffect(() => cancel, []);
  const eligible = canReact(message);
  const reactions = rows.filter(row => row.message_id === message.id && row.emoji);
  const choices = message.platform === 'messenger' ? REACTION_CHOICES.slice(0, 1) : REACTION_CHOICES;
  return <div className="group/reaction relative" data-message-id={message.id}
    onPointerDown={e => {
      if (!eligible || e.pointerType === 'mouse' || (e.target instanceof Element && e.target.closest('button,a,audio,video,input'))) return;
      cancel(); fired.current = false; start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => { fired.current = true; setOpen(true); }, 500);
    }}
    onPointerMove={e => { if (movedTooFar(start.current, e.clientX, e.clientY)) cancel(); }}
    onPointerUp={cancel} onPointerCancel={cancel} onContextMenu={e => { if (eligible && fired.current) e.preventDefault(); }}
    onClickCapture={e => { if (fired.current) { e.preventDefault(); e.stopPropagation(); fired.current = false; } }}>
    {children}
    {eligible && <Popover open={open} onOpenChange={setOpen}>
      <Tooltip><TooltipTrigger asChild><PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label="React to message" className="absolute right-1 top-1 h-8 w-8 bg-background opacity-100 md:opacity-0 md:group-hover/reaction:opacity-100 md:group-focus-within/reaction:opacity-100" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SmilePlus className="h-4 w-4" />}
        </Button>
      </PopoverTrigger></TooltipTrigger><TooltipContent>React to message</TooltipContent></Tooltip>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-2" align="end">
        <div className="flex gap-1">{choices.map(choice => <Button key={choice.emoji} variant="ghost" size="icon" aria-label={choice.label} disabled={busy} aria-pressed={reactions.some(row => row.actor_type === 'staff' && row.emoji === choice.emoji)} className="h-11 w-11 text-xl" onClick={async () => {
          setBusy(true); const success = await react(message, choice.emoji); setBusy(false); if (success) setOpen(false);
        }}>{choice.emoji}</Button>)}</div>
      </PopoverContent>
    </Popover>}
    {reactions.length > 0 && <div className="mt-1 flex flex-wrap gap-1" aria-live="polite">{reactions.map(row => <span key={row.actor_type} className="inline-flex items-center gap-1 rounded border bg-muted px-2 py-0.5 text-xs" title={row.actor_type === 'staff' ? 'Team reaction' : 'Customer reaction'}>{row.emoji} {row.actor_type === 'staff' ? 'Team' : 'Customer'}</span>)}</div>}
  </div>;
}