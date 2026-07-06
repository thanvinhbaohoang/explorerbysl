## Goal

When a Telegram user shares a location (either a raw pin or a Telegram "venue"), our app should:

1. Save it as a real message (not silently drop it).
2. Show a nice bubble in the chat with the human-readable address, coordinates, a small static map preview, and a "Open in Google Maps" link.

Today the webhook handler in `supabase/functions/telegram-bot/index.ts` handles text/photo/voice/video/video_note/audio/document but has **no branch for `message.location` or `message.venue`**, so location shares are dropped on the floor.

## Changes

### 1. Database — add location columns to `messages`

New migration adding nullable columns to `public.messages`:

- `latitude double precision`
- `longitude double precision`
- `location_address text` — reverse-geocoded human address (nullable; filled async)
- `location_title text` — Telegram venue title (e.g. "Aeon Mall Sen Sok"), null for plain pins
- `location_live_period integer` — seconds, present when it's a Telegram live location

No new table, no policy changes (existing RLS on `messages` already covers this).

### 2. Edge function — `telegram-bot/index.ts`

Add a handler branch alongside the existing media branches for the incoming user message:

- If `message.venue` is present: use `venue.location.latitude/longitude`, `venue.title`, `venue.address` (Telegram already gives us the address for venues — no external call needed).
- Else if `message.location` is present: use `location.latitude/longitude`, `location.live_period`. Reverse-geocode to an address (see #3).
- Insert a row with `message_type = 'location'`, `message_text = title || address || "[Location]"`, plus the new lat/long/address columns.

### 3. Reverse geocoding (for plain pins)

**Preferred: Google Maps Platform connector** (already documented in the project, high-quality addresses, works globally including Khmer place names). If not linked yet, we'll link it via `standard_connectors--connect` at build time — no user secret needed. Call the Geocoding API through the connector gateway from the edge function.

**Fallback if user declines the connector:** OpenStreetMap Nominatim (`https://nominatim.openstreetmap.org/reverse`) — free, no key, but lower quality and required to send a descriptive `User-Agent`.

Reverse geocode inline in the webhook (fast, ~200-500ms). If it fails or times out (>2s), still save the message with coordinates and leave `location_address` null — the UI will just show coordinates + map link.

### 4. Client — render location bubbles

**`src/hooks/useChatMessages.ts`**: extend the message row type with `latitude`, `longitude`, `location_address`, `location_title`, `location_live_period`.

**`src/components/ChatPanel.tsx`**: add a `message.message_type === 'location'` branch in the bubble renderer. Bubble contents:

- Line 1 (bold): `location_title` if present, else `"Shared location"`. Show a small "Live" badge if `location_live_period` is set.
- Line 2: `location_address` if present, else `"Address unavailable"`.
- Line 3 (muted mono): `12.34567, 104.56789`.
- A small static map thumbnail (Google Static Maps via connector, or an OSM static tile as fallback).
- A button/link: **Open in Google Maps** → `https://www.google.com/maps?q=<lat>,<lng>` (opens in new tab / native maps app on mobile).

**`src/components/ChatPanel.tsx` media viewer arrays** (around L236): skip location messages — they're not media.

**`src/components/ChatConversationList.tsx`** (last-message preview): show `📍 <title or address or "Location">` for `message_type === 'location'` so the inbox preview isn't blank.

### 5. Out of scope

- **Sending** a location from the CRM to the customer — user asked about receiving/displaying only.
- Facebook Messenger location attachments — same pattern can be added to `messenger-webhook/index.ts` later if wanted; not touching it now.
- Storing full address components (city/country/postal separately) — one `location_address` string is enough for the chat UI.

## Result

When ប៊ុន វណ្ណា (or anyone) drops a pin or shares a venue in Telegram, the chat shows something like:

> **Aeon Mall Sen Sok** *(or "Shared location")*
> 132 Street 1003, Phnom Penh, Cambodia
> `11.58472, 104.89921`
> [static map thumbnail]
> [ Open in Google Maps ]

instead of the message disappearing.

## Question before I build

Do you want me to wire up the **Google Maps connector** for higher-quality addresses and the static map thumbnail (recommended, no cost for typical usage), or keep it dependency-free with **OpenStreetMap / Nominatim** (free, no setup, slightly rougher addresses especially for Khmer place names)?