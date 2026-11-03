# Roadmap

## In progress: Inbox filters (All / Unread / Not Replied)
- [ ] Apply additive migration: `get_filtered_customer_ids` RPC (SECURITY INVOKER, REVOKE PUBLIC/anon, GRANT authenticated)
- [ ] Regenerate Supabase types and verify RPC present
- [ ] `useCustomersData.ts`: filter param, 7th cache-key element for filtered modes, RPC fetch + validation
- [ ] `Chat.tsx`: lift filter state, pass to both ChatConversationList instances
- [ ] `ChatConversationList.tsx`: segmented control, error state with retry, keepPreviousData guard, predicate invalidation, page clamp
- [ ] EXPLAIN ANALYZE both filter modes; add index IF NOT EXISTS if needed
- [ ] Verify build + behavior
