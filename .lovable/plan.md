## Problem

Staff names displayed in chat messages, notes, action items, and other places are derived from `user.email.split('@')[0]` instead of the `display_name` configured on the Roles page (`user_roles.display_name`).

## Fix

Use the existing `displayName` already loaded by `useUserPermissions()` as the source of truth for the current user's name, with a sensible fallback chain:

```
display_name (from user_roles)
  → user_metadata.full_name / name
  → email prefix (email.split('@')[0])
  → 'Employee' / 'Unknown'
```

### 1. Add a small helper hook `useCurrentUserName()`

New file `src/hooks/useCurrentUserName.ts` that returns a single string by combining `useAuth()` + `useUserPermissions()` using the fallback chain above. Centralizing this prevents future drift.

### 2. Replace every `user?.email?.split('@')[0]` usage

Files (all client-side, presentation only):

- `src/hooks/useChatMessages.ts` — 5 occurrences (sendMessage, sendPhoto, sendVoice, sendDocument paths)
- `src/pages/Customers.tsx` — 6 occurrences (same send-message flows in the customers page chat)
- `src/components/QuickActionsPanel.tsx` — 1 occurrence (`completed_by_name`)
- `src/components/CustomerNotesSection.tsx` — 1 occurrence (`created_by_name`)

In each file, replace the inline `email.split('@')[0]` with the value from the new `useCurrentUserName()` hook (or pass it in). The value is then sent as `sent_by_name` / `completed_by_name` / `created_by_name` when inserting into the DB, so going forward all new messages, notes, and action items will store the display name.

### 3. Historical rows

Existing messages/notes already in the DB will keep their old email-prefix `sent_by_name`. This plan does not rewrite history — it only fixes display going forward. If desired, a one-off backfill can be added later.

### Out of scope

- No schema changes, no RLS changes, no edge function changes.
- No changes to how the display name is *edited* (still done on the Roles page).
- Reading display names for *other* users in existing chat history is unchanged — UI already shows whatever `sent_by_name` was saved at send time.

### Verification

1. Set a custom Display Name for the logged-in user on `/user-roles`.
2. Send a chat message → the green "sent by" badge shows the new display name (not the email prefix).
3. Add a customer note and complete an action item → entries show the display name.
4. Old messages still show their original stored name (expected).
