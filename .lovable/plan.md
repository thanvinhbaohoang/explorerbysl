

## Diagnosis: Why new chat messages don't look bolded/colored

After tracing the code:

**The data is fine.** DB has 1,255 unread customer messages. Realtime is enabled on `messages`. `unreadCounts` state increments correctly on incoming messages. `markMessagesAsRead` is exported but never called, so messages stay unread.

**The visuals are too weak.** In `ChatConversationList.tsx` (lines 846–889) the unread cues are:
- Row background: `bg-primary/5` — only **5% opacity** of primary, almost invisible on most themes
- Name: `font-medium` → `font-semibold` — a barely perceptible weight bump
- Preview text: `text-foreground` vs `text-muted-foreground` — subtle in light mode
- Red badge with count — the only strong signal

Two additional issues compound this:
1. **Class precedence conflict**: when a row is selected, both `bg-muted` and `bg-primary/5` are applied. Tailwind picks whichever appears later in the generated stylesheet — unpredictable, and `bg-muted` often wins, hiding the unread tint on the active row.
2. **No left accent or dot indicator** — Messenger/WhatsApp use a colored dot or bar, which is much more scannable than a faint background.

So new messages *are* technically being marked unread; the UI just isn't selling it.

## Fix Plan

Make unread state visually unmistakable in `src/components/ChatConversationList.tsx`:

1. **Stronger row background**: `bg-primary/5` → `bg-primary/10` and only apply when row is **not** selected (resolves the precedence conflict).
2. **Left accent bar**: add a 3px colored left border (`border-l-[3px] border-l-primary`) on unread rows for instant scannability.
3. **Bolder name**: `font-semibold` → `font-bold` for unread names, kept at `font-medium` otherwise.
4. **Stronger preview text**: keep `text-foreground` but add a small unread dot (●) before the timestamp when `unreadCount > 0`.
5. **Keep** the existing pulsing red count badge.

No data, hook, or realtime changes needed — purely a styling fix to ~10 lines around the row render.

