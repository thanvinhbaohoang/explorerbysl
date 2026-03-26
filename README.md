<p align="center">
  <h1 align="center">🚀 Explorer by SL</h1>
  <p align="center">
    <strong>Omnichannel CRM for Telegram & Messenger — Real-time chat, lead attribution, and customer intelligence in one powerful dashboard.</strong>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Supabase-Realtime-3FCF8E?style=flat-square&logo=supabase" alt="Supabase" />
    <img src="https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss" alt="Tailwind" />
    <img src="https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite" alt="Vite" />
  </p>
</p>

---

## 🎯 What is Explorer?

Explorer is a **production-grade customer engagement platform** built for businesses that manage conversations across **Telegram** and **Facebook Messenger**. Instead of juggling multiple apps, your team gets a single real-time inbox with deep analytics, AI-powered summaries, and full lead attribution — from first ad click to latest message.

> **Built for operators.** Whether you're running ads on Facebook, managing a Telegram community, or handling customer support — Explorer gives you the visibility and tools to move fast.

---

## ⚡ Key Features

<table>
<tr>
<td width="50%">

### 💬 Unified Inbox
- Real-time conversations across Telegram & Messenger
- Send text, photos, videos, voice notes & documents
- Drag-and-drop attachments, clipboard paste, album batching
- Voice recording with live waveform visualization
- AI-powered conversation summaries

</td>
<td width="50%">

### 👥 Customer Intelligence
- Centralized directory with advanced search & filters
- Cross-platform identity linking (same person on TG + Messenger)
- Customer profiles with notes, action items & identity docs
- Automatic profile pic sync & language detection
- Full conversation history across platforms

</td>
</tr>
<tr>
<td width="50%">

### 📊 Attribution & Analytics
- End-to-end lead tracking: UTM → Click → Conversation
- Facebook Ads insights with campaign-level drill-down
- Traffic dashboard with source/medium breakdowns
- Facebook Click ID correlation to customer records

</td>
<td width="50%">

### 🔐 Team & Access Control
- Role-based permissions (Admin / Moderator / User)
- User approval workflow for new team members
- Employee name attribution on every sent message
- Audit-friendly action tracking

</td>
</tr>
</table>

### 🔔 Real-time Everything
- **Live message push** — new messages appear instantly via Supabase Realtime
- **Unread counters** — per-conversation badge counts
- **Sound notifications** — configurable audio alerts
- **Webhook health monitoring** — see connection status at a glance

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│  (Vite + TypeScript + Tailwind + shadcn/ui)             │
├─────────────────────────────────────────────────────────┤
│              TanStack React Query (State)                │
├──────────┬──────────┬───────────────┬───────────────────┤
│ Supabase │ Supabase │   Supabase    │    Supabase       │
│   Auth   │ Realtime │   Storage     │   PostgreSQL      │
├──────────┴──────────┴───────────────┴───────────────────┤
│               Supabase Edge Functions                    │
│  ┌──────────────┐ ┌────────────────┐ ┌───────────────┐  │
│  │ telegram-bot │ │ messenger-     │ │ summarize-    │  │
│  │              │ │ webhook        │ │ chat (AI)     │  │
│  └──────┬───────┘ └───────┬────────┘ └───────────────┘  │
│         │                 │                              │
├─────────┴─────────────────┴──────────────────────────────┤
│        Telegram Bot API    │    Facebook Graph API        │
└────────────────────────────┴─────────────────────────────┘
```

---

## 📂 Project Structure

```
src/
├── components/          # UI components
│   ├── ui/              # shadcn/ui primitives (40+ components)
│   ├── ChatPanel.tsx    # Full-featured conversation view
│   ├── ChatConversationList.tsx
│   ├── MediaViewer.tsx  # Image/video viewer with zoom
│   └── ...
├── contexts/            # React context providers
├── hooks/               # Business logic hooks
│   ├── useChatMessages  # Chat engine (send, receive, record, upload)
│   ├── useCustomersData # Customer fetching with pagination
│   ├── useTrafficData   # Lead attribution queries
│   └── ...
├── pages/               # Route-level views
│   ├── Chat.tsx         # Resizable split-pane inbox
│   ├── Customers.tsx    # Customer directory
│   ├── Dashboard.tsx    # Overview & analytics
│   └── ...
├── lib/                 # Utilities
└── integrations/        # Auto-generated Supabase client & types

supabase/
├── functions/
│   ├── telegram-bot/          # Telegram webhook & message handler
│   ├── messenger-webhook/     # Facebook Messenger webhook (multi-page)
│   ├── summarize-chat/        # AI-powered conversation summaries
│   ├── fetch-facebook-ads/    # Ad performance data fetcher
│   ├── backfill-profile-pics/ # Batch profile pic downloader
│   └── monday-import/         # Monday.com data importer
└── config.toml
```

---

## 🛠 Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | React 18 · TypeScript 5 · Vite 5 |
| **UI** | Tailwind CSS · shadcn/ui · Radix UI · Lucide Icons |
| **State & Data** | TanStack React Query · Supabase Realtime subscriptions |
| **Backend** | Supabase Edge Functions (Deno) · PostgreSQL with RLS |
| **Storage** | Supabase Storage (chat attachments, profile pics) |
| **Auth** | Supabase Auth with role-based access control |
| **APIs** | Facebook Graph API · Telegram Bot API |
| **Charts** | Recharts |
| **Deployment** | Lovable Cloud |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- A [Supabase](https://supabase.com) project

### Setup

```bash
# Clone and install
git clone <your-repo-url>
cd explorer-by-sl
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# Start dev server
npm run dev
```

### Required Secrets (Supabase Dashboard → Edge Function Secrets)

| Secret | Source |
|--------|--------|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) |
| `FACEBOOK_APP_ID` | [Meta for Developers](https://developers.facebook.com) |
| `FACEBOOK_APP_SECRET` | Meta App Dashboard → Settings → Basic |
| `FACEBOOK_SYSTEM_USER_TOKEN` | Meta Business Suite → System Users |
| `FACEBOOK_VERIFY_TOKEN` | Any random string (must match webhook config) |

---

## 🔑 Key Design Decisions

- **Multi-page Messenger support** — handles multiple Facebook Pages from a single webhook, with per-page access tokens stored in the database
- **Cross-platform customer linking** — bidirectional linking between Telegram and Messenger identities for unified conversation history
- **Optimistic UI** — messages appear instantly in the chat with pending state, rolled back on failure
- **Auto-healing data** — webhook automatically backfills missing customer metadata (profile pics, names, page IDs) on every incoming message
- **Row-Level Security** — all database tables protected with Supabase RLS policies; role checks via `SECURITY DEFINER` functions to prevent recursive policy evaluation

---

## 📄 License

Private project — All rights reserved.

---

<p align="center">
  Built with ❤️ using <a href="https://lovable.dev">Lovable</a>
</p>
