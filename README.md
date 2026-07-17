# jot-push

Push notification backend for [Jot](https://zvcodez.github.io/jot/) — makes
reminders fire even when the app/browser is fully closed or the phone is
locked, which the app's local `setTimeout` can't reliably do (iOS throttles
background tab timers to roughly once a minute, and suspends them entirely
once the tab has been backgrounded/screen-locked for a while).

## How it works

- The Jot frontend (static, on GitHub Pages) subscribes to Web Push and POSTs
  the subscription + each reminder's `{id, text, dueAt, done, deletedAt}` to
  this backend as things change (`push.js` in the `jot` repo).
- State lives in `data/push-queue.json` in the private `zvcodez/jot-data`
  GitHub repo (via the Contents API) — no database needed for this little
  data. This is separate from the file the client's own optional GitHub sync
  uses, so the two never race on the same file.
- `GET /api/check?token=...` scans for reminders that are due and not yet
  notified, sends a Web Push to every stored subscription via `web-push`
  (VAPID), marks a reminder notified only once a send actually succeeds (so
  one with no subscription yet, or a transient send failure, stays eligible
  for the next run instead of being silently lost), and prunes done/deleted
  entries plus anything more than 2 days past due regardless of notified
  state.
- Something has to call `/api/check` on a schedule. **Vercel Cron on the Hobby
  plan only runs once a day** — not useful for reminders. A GitHub Actions
  scheduled workflow in this repo is *configured* to ping it every 2 minutes,
  but GitHub's scheduler is best-effort and in practice deprioritizes quiet
  high-frequency crons — observed gaps of 3-6 hours between runs, which
  defeats the purpose. **[cron-job.org](https://cron-job.org)** (free,
  supports true minutely scheduling) pings `/api/check?token=<CRON_SECRET>`
  as the primary pinger; GitHub Actions is kept as a redundant backup.

## Environment variables (set in Vercel)

| Var | Purpose |
| --- | --- |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push signing keypair (generated once via `npx web-push generate-vapid-keys`) |
| `GITHUB_TOKEN` | Fine-grained PAT scoped to **only** `zvcodez/jot-data`, Contents: Read and write. Server-side only, never sent to the browser. |
| `JOT_API_TOKEN` | Shared secret the client sends as `X-Jot-Token` on `/api/subscribe` and `/api/reminder`, so randoms can't write into the queue. |
| `CRON_SECRET` | Token the GitHub Actions ping must supply as `?token=` on `/api/check`. Also stored as a **repository secret** (Settings → Secrets and variables → Actions) on this repo, since it's public, so it never appears in plaintext in the workflow file. |

## Endpoints

- `POST /api/subscribe` — body: `PushSubscription.toJSON()`. Upserts by endpoint.
- `POST /api/reminder` — body: `{id, text, dueAt, done, deletedAt, notified}`. Upserts by id.
- `GET /api/check?token=` — the cron target. Sends due pushes, prunes stale entries.

## Deploy

```bash
cd jot-push
vercel deploy --prod
```

Then set the env vars above via `vercel env add <NAME> production` (or the
dashboard), and redeploy.
