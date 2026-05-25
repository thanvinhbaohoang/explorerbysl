## Goal
Extend the chat customer search (top of ChatConversationList) to also match by username and platform IDs, not just names.

## Current behavior
`src/components/ChatConversationList.tsx` (~line 459) only searches:
`first_name, last_name, username, messenger_name` via ilike.

Note: `username` is already included, but the user likely wants ID matching too (telegram_id, messenger_id).

## Change
Update the `.or(...)` filter in the debounced search effect to also match:
- `messenger_id` (text) — via `ilike.%query%`
- `telegram_id` (bigint) — only when the query is all digits, add `telegram_id.eq.<number>` to the OR clause

Pseudocode:
```ts
const parts = [
  `first_name.ilike.%${query}%`,
  `last_name.ilike.%${query}%`,
  `username.ilike.%${query}%`,
  `messenger_name.ilike.%${query}%`,
  `messenger_id.ilike.%${query}%`,
];
if (/^\d+$/.test(query)) parts.push(`telegram_id.eq.${query}`);
searchQ = searchQ.or(parts.join(","));
```

## Out of scope
- No DB/schema/RLS changes
- No changes to CRM Customers page search (separate hook)
- No UI changes beyond the existing search input behavior