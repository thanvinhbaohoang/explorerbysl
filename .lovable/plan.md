## Change

Reduce the Telegram webhook health-check cron from every 5 minutes to every 4 hours.

## Why

- Webhook registration doesn't expire on a timer — it only breaks on rare events (someone calls `setWebhook` again, token rotation, URL change).
- Telegram queues undelivered updates for ~24 hours and replays them once the webhook is restored, so a repair delay of a few hours causes **no message loss**.
- 5-minute cadence = ~8,640 invocations/month for a check that almost never needs to act. 4-hour cadence = ~180/month, same practical safety.

## Steps

1. Unschedule the existing `telegram-webhook-health-check` cron job.
2. Reschedule it with expression `0 */4 * * *` (top of every 4th hour) calling the same `telegram-bot` edge function with `action: "health_check"`.
3. Verify with `cron.job` that only one job exists and the schedule is `0 */4 * * *`.

No code changes to the edge function — the `health_check` action stays as-is.
