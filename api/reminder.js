import { readQueue, writeQueue } from '../lib/store.js';
import { withCors, handlePreflight, checkToken } from '../lib/cors.js';

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') { withCors(res).status(405).json({ error: 'POST only' }); return; }
  if (!checkToken(req, res)) return;

  const { id, text, dueAt, done, deletedAt, notified } = req.body || {};
  if (!id) { withCors(res).status(400).json({ error: 'Missing id' }); return; }

  try {
    const q = await readQueue();
    const reminders = q.reminders.filter((r) => r.id !== id);
    reminders.push({
      id, text: text || '', dueAt: dueAt || null,
      done: !!done, deletedAt: deletedAt || null, notified: !!notified,
    });
    await writeQueue({ subscriptions: q.subscriptions, reminders, sha: q.sha });
    withCors(res).status(200).json({ ok: true });
  } catch (e) {
    withCors(res).status(500).json({ error: e.message });
  }
}
