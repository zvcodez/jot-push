import { readQueue, writeQueue } from '../lib/store.js';
import { withCors, handlePreflight, checkToken } from '../lib/cors.js';

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') { withCors(res).status(405).json({ error: 'POST only' }); return; }
  if (!checkToken(req, res)) return;

  const sub = req.body;
  if (!sub || !sub.endpoint) { withCors(res).status(400).json({ error: 'Missing subscription' }); return; }

  try {
    const q = await readQueue();
    const subscriptions = q.subscriptions.filter((s) => s.endpoint !== sub.endpoint);
    subscriptions.push(sub);
    await writeQueue({ subscriptions, reminders: q.reminders, sha: q.sha });
    withCors(res).status(200).json({ ok: true });
  } catch (e) {
    withCors(res).status(500).json({ error: e.message });
  }
}
