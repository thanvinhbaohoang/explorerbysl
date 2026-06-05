## What I found
- The page `109469038735899` is now fully subscribed, including `message_echoes`.
- Recent webhook logs show normal inbound customer messages reaching the backend.
- I do **not** see a raw echo event from Facebook for the employee-sent reply after re-subscribe, which means the problem is now either:
  - Facebook is not delivering the echo event for that action/thread, or
  - the webhook receives a different event shape (echo / standby / handover-related) that our parser currently ignores.

## Plan
1. Add a read-only diagnostic endpoint for Messenger webhook delivery.
   - Return the most recent raw webhook event shapes relevant to a page.
   - Include whether we saw `message.is_echo`, `standby`, `messaging_handovers`, or only normal customer messages.

2. Tighten webhook handling for page-sent messages.
   - Verify the parser accepts Facebook echo events where the page/user roles are flipped from normal inbound messages.
   - Handle the event shapes used when staff reply from the page inbox, not just standard inbound `messaging` events.

3. Validate the end-to-end flow.
   - Send a fresh reply from the page inbox to the same thread.
   - Check whether the diagnostic endpoint shows a delivered echo event.
   - If delivered, finish the parser/storage fix so it lands in the chat collection.
   - If not delivered, we’ll know this is a Facebook-side delivery/configuration issue rather than an app storage issue.

## Technical details
- Verified via `subscription-status`: `message_echoes` is present for Explorer by SL.
- Verified via webhook logs: inbound customer message events are arriving for that page, but no matching outbound echo event is visible yet.
- Most likely missing cases to inspect are `message.is_echo`, alternate event containers, or inbox/handover-specific delivery behavior.