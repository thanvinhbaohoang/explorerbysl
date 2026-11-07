# Reply capability evidence (Phase 1)
Live effects so far: two real test messages sent from the sandbox (no code deployed yet).
- Telegram staff→customer text: sendMessage reply_parameters.message_id=114945 → HTTP 200, new message 115606, response echoes reply_to_message 114945. Phone: PASS (user confirmed quote on "Test" message, 2026-11-07).
- Explorer Messenger staff→customer text: reply_to.mid=m_HFvBBT…hA → HTTP 200, mid m__P92W…jqQ. Phone: PASS (user confirmed quote on latest message, 2026-11-07).
- Telegram staff→customer photo: sendPhoto reply_parameters.message_id=114945 → ok:true, msg 115608, reply_to 114945. Phone: PASS (user confirmed quote on "Test", 2026-11-07).
- Explorer Messenger staff→customer photo: image attachment + reply_to.mid → HTTP 200, mid m_9E8UGDj…EXw, attachment_id 4551644701716451. (First attempt failed #100 because picsum redirects; resolved final URL succeeded.) Phone: PASS (user confirmed quote, 2026-11-07).
- Travel Agency: no approved Huth Sakda chat on that Page → UNAVAILABLE (needs an approved test chat).
- Messenger incoming log keeps full events (1 of 200 has reply_to). Telegram needs temporary capture (not yet deployed).
