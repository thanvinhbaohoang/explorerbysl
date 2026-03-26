# Explorer by SL

A unified customer relationship management platform for businesses that engage customers across **Telegram** and **Facebook Messenger**. Built for teams that need real-time conversations, lead attribution, and customer insights — all in one place.

---

## ✨ Features

### 💬 Omnichannel Chat
- Unified inbox for **Telegram** and **Messenger** conversations
- Real-time messaging with text, photos, videos, voice notes, and documents
- Drag-and-drop file attachments and clipboard paste support
- Album/batch media sending
- Voice recording with waveform preview
- AI-powered chat summaries
- Linked customer profiles across platforms

### 👥 Customer Management
- Centralized customer directory with search, filters, and pagination
- Customer identity cards with legal name, nationality, and passport details
- Notes and action items per customer
- Platform linking — connect the same person's Telegram and Messenger accounts
- Profile picture sync from Messenger

### 📊 Analytics & Attribution
- **Traffic dashboard** — track how customers discover your bot (UTM params, Facebook Click IDs, referrals)
- **Ads Insight** — view Facebook ad performance data alongside customer conversations
- Lead source tracking with campaign, ad set, and ad-level attribution

### 🔧 System Administration
- **Facebook Pages** — manage connected pages, sync tokens, and monitor webhook health
- **Telegram Bot** — configure welcome messages and webhook registration
- **Role-based access control** — admin, moderator, and user roles with granular permissions
- User approval workflow for new team members

### 🔔 Real-time Updates
- Live message notifications with sound alerts
- Unread message counts per conversation
- Real-time customer and message subscriptions

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, shadcn/ui |
| **State** | TanStack React Query |
| **Backend** | Supabase (PostgreSQL, Auth, Edge Functions, Storage, Realtime) |
| **Integrations** | Facebook Graph API, Telegram Bot API |
| **Deployment** | Lovable Cloud |

---

## 📁 Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── ui/           # shadcn/ui primitives
│   ├── ChatPanel.tsx # Conversation view
│   └── ...
├── contexts/         # Auth context provider
├── hooks/            # Custom React hooks (chat, customers, roles, traffic)
├── lib/              # Utilities (CSV export, image conversion, language detection)
├── pages/            # Route-level page components
└── integrations/     # Supabase client & type definitions

supabase/
├── functions/        # Edge functions (webhooks, AI summaries, imports)
│   ├── telegram-bot/
│   ├── messenger-webhook/
│   ├── summarize-chat/
│   └── ...
└── config.toml
```

---

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd <project-folder>
   npm install
   ```

2. **Set up environment variables**
   Create a `.env` file with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```

3. **Configure secrets** (in Supabase dashboard)
   - `TELEGRAM_BOT_TOKEN` — from [@BotFather](https://t.me/BotFather)
   - `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_SYSTEM_USER_TOKEN` — from [Meta for Developers](https://developers.facebook.com)

4. **Run locally**
   ```bash
   npm run dev
   ```

---

## 📄 License

Private project — all rights reserved.
