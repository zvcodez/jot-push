import webpush from 'web-push';
import { readQueue, writeQueue } from '../lib/store.js';

webpush.setVapidDetails(
  'mailto:neilpatel360@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.query.token !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  try {
    const q = await readQueue();
    const now = Date.now();
    const due = q.reminders.filter(
      (r) => r.dueAt && !r.done && !r.deletedAt && !r.notified && new Date(r.dueAt).getTime() <= now
    );

    let subscriptions = q.subscriptions;
    let sent = 0;

    for (const reminder of due) {
      for (const sub of subscriptions) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await webpush.sendNotification(sub, JSON.stringify({
            title: 'Jot ⏰', body: reminder.text, tag: reminder.id,
          }));
          sent += 1;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            subscriptions = subscriptions.filter((s) => s.endpoint !== sub.endpoint);
          }
        }
      }
      reminder.notified = true;
    }

    // Prune reminders that are done, soft-deleted, or notified more than 2 days ago.
    const cutoff = now - 2 * 86400000;
    const reminders = q.reminders.filter((r) => {
      if (r.done || r.deletedAt) return false;
      if (r.notified && r.dueAt && new Date(r.dueAt).getTime() < cutoff) return false;
      return true;
    });

    if (due.length || reminders.length !== q.reminders.length || subscriptions.length !== q.subscriptions.length) {
      await writeQueue({ subscriptions, reminders, sha: q.sha });
    }

    res.status(200).json({ checked: q.reminders.length, due: due.length, sent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
