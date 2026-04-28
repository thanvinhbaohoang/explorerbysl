## Public Home Page

Replace the current root redirect (`/` → `/customers`) with a public, no-auth marketing landing page that introduces ExplorerBySL and links into the app via `/auth`.

### Routing change (`src/App.tsx`)
- Remove the `Navigate to="/customers"` on `/`.
- Add `<Route path="/" element={<Home />} />` (public, no `ProtectedRoute`).
- Authenticated users hitting `/auth` already get routed into the app, so the Launch button just sends them to `/auth`.

### New page (`src/pages/Home.tsx`)
Single-file landing page styled with existing Tailwind tokens (`bg-background`, `text-foreground`, `text-primary`, etc.) — matches the rest of the app, no new design system. Sections:

1. **Hero**
   - Logo (existing favicon URL) + "ExplorerBySL"
   - Tagline: "Your Journey Imagination, Our Professional Creation."
   - Short description: internal business tool by Explorer by SL for managing customer communications across Facebook Messenger and Telegram.
   - Primary CTA button: **Launch App** → navigates to `/auth`
   - Secondary link: Privacy Policy → `/privacy-policy`

2. **What it does** (3–4 feature cards using `Card` from `@/components/ui/card` + lucide icons):
   - Unified Customer Inbox — Messenger + Telegram in one chat view
   - CRM & Customer Tracking — identity, notes, tags, activity timeline
   - Ads Insight — Facebook ad performance and lead attribution
   - Team Roles & Permissions — granular RBAC for staff

3. **Footer**
   - "© 2026 Explorer by SL" • Privacy Policy link • Facebook link (facebook.com/explorerbysl) • Email link

### Behavior notes
- Page is fully public — no auth checks, no data fetching. Safe for Facebook crawlers and external visitors.
- "Launch App" uses `react-router` `Link` to `/auth`. `AuthContext` will redirect already-signed-in users into the app per existing flow.
- Override the document title on this page to "ExplorerBySL — Customer Communications Platform" via a small `useEffect`.

### Files touched
- `src/App.tsx` — swap root route
- `src/pages/Home.tsx` — new file
