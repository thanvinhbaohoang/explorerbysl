# Reply capability evidence (Phase 1)
Live effects so far: two real test messages sent from the sandbox (no code deployed yet).
- Telegram staff→customer text: sendMessage reply_parameters.message_id=114945 → HTTP 200, new message 115606, response echoes reply_to_message 114945. Phone: PENDING.
- Explorer Messenger staff→customer text: reply_to.mid=m_HFvBBT…hA → HTTP 200, mid m__P92W…jqQ. Phone: PENDING.
- Travel Agency: no approved Huth Sakda chat on that Page → UNAVAILABLE (needs an approved test chat).
- Messenger incoming log keeps full events (1 of 200 has reply_to). Telegram needs temporary capture (not yet deployed).
