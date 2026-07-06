## Goal

Replace generic "Failed to send message" / "non-2xx" toasts with a specific reason from Telegram — e.g. "This user blocked the bot", "User hasn't started the bot yet", "Message too long (max 4096 chars)", "Rate limited — retry in 12s".

## What's wrong today

- `supabase.functions.invoke()` throws a generic `FunctionsHttpError` whose `.message` is literally `"Edge Function returned a non-2xx status code"`. The real Telegram error text is in the response *body*, not `.message`.
- In `telegram-bot/index.ts`, `sendMessage` / `sendPhoto` / `sendVoice` / `sendVideo` / `sendDocument` throw a plain `Error` with Telegram's raw text. The handlers catch it and return `{ error: error.message }` with status 500 — the body is fine, but the client never reads it.
- Client callers (`useChatMessages.ts` lines 467, 576, 702, 980) only look at `error.message`, so the useful text is lost.

## Changes

### 1. Edge function — return structured Telegram errors (`supabase/functions/telegram-bot/index.ts`)

- Add a `TelegramError` class that carries `telegram_error_code` (e.g. 403, 400, 429), `description` (raw from Telegram), and `retry_after` (from `parameters.retry_after` on 429s).
- Change `sendMessage`, `sendPhoto`, `sendVoice`, `sendVideo`, `sendDocument` to parse Telegram's JSON response and throw `TelegramError` instead of a plain `Error` with a stringified body.
- In the `send_message` and `send_media` handlers, catch `TelegramError` and return a JSON body like:
  ```json
  {
    "error": "telegram_api_error",
    "telegram_error_code": 403,
    "telegram_description": "Forbidden: bot was blocked by the user",
    "reason": "blocked",
    "retry_after": null
  }
  ```
  with a status matching the Telegram error (403/400/429/500). Map `description` → `reason` tag: `blocked` (403 blocked), `deactivated` (403 deactivated), `chat_not_found` (400 chat not found), `message_too_long` (400 message is too long), `rate_limited` (429), `unknown`.

### 2. Client — surface the real reason (`src/hooks/useChatMessages.ts`)

Add a small helper (top of file):

```ts
async function formatSendError(error: any, data: any, fallback: string): Promise<string> {
  // supabase-js v2: on non-2xx, body is on error.context (a Response). data may be null.
  let body: any = data;
  if (!body && error?.context && typeof error.context.json === 'function') {
    try { body = await error.context.json(); } catch { /* ignore */ }
  }
  const code = body?.telegram_error_code;
  const desc = body?.telegram_description as string | undefined;
  const reason = body?.reason as string | undefined;
  const retry = body?.retry_after as number | undefined;

  switch (reason) {
    case 'blocked':          return 'This user has blocked the bot. They must unblock it before you can send messages.';
    case 'deactivated':      return 'This Telegram account is deactivated.';
    case 'chat_not_found':   return "This user hasn't started a chat with the bot yet. Ask them to open the bot link and press Start.";
    case 'message_too_long': return 'Message is too long. Telegram allows up to 4096 characters (1024 for captions).';
    case 'rate_limited':     return `Rate limited by Telegram. Try again in ${retry ?? '30'}s.`;
  }
  if (desc) return `Telegram: ${desc}${code ? ` (${code})` : ''}`;
  return `${fallback}${error?.message ? ` — ${error.message}` : ''}`;
}
```

Update the four failure branches in `useChatMessages.ts` to use it:

- L467 text send  → `toast.error(await formatSendError(error, data, 'Failed to send message'), { duration: 8000 });`
- L576 media send → `toast.error(await formatSendError(error, data, 'Failed to send media'), { duration: 8000 });`
- L702 album send → `toast.error(await formatSendError(error, data, 'Failed to send album'), { duration: 8000 });`
- L980 voice send → `toast.error(await formatSendError(error, data, 'Failed to send voice message'), { duration: 8000 });`

(Each of those blocks already has `data` and `error` from `supabase.functions.invoke` in scope.)

### 3. Out of scope

- No changes to messenger-webhook error surfacing (user asked about the Telegram non-2xx specifically). Same pattern can be added there later if wanted.
- No retry logic — surfacing only.
- No new dependencies, no DB / schema / config changes.

## Result

Next time you message ប៊ុន វណ្ណា and it fails, the toast will say something like *"This user has blocked the bot..."* or *"This user hasn't started a chat with the bot yet..."* instead of *"non-2xx status code"*, and you'll know immediately which of the causes from the previous message is happening.