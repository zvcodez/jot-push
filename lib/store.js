// Reads/writes data/push-queue.json in the private zvcodez/jot-data repo via
// the GitHub Contents API. This is the server's own storage — separate from
// (and independent of) the client's optional GitHub-sync of items.json, so
// the two never race on the same file.
const OWNER = 'zvcodez';
const REPO = 'jot-data';
const BRANCH = 'main';
const PATH = 'data/push-queue.json';

function headers() {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  };
}

const url = () => `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
const enc = (str) => Buffer.from(str, 'utf-8').toString('base64');
const dec = (b64) => Buffer.from(b64, 'base64').toString('utf-8');

export async function readQueue() {
  const res = await fetch(`${url()}?ref=${BRANCH}`, { headers: headers() });
  if (res.status === 404) return { sha: null, subscriptions: [], reminders: [] };
  if (!res.ok) throw new Error(`GitHub read failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  let parsed = { subscriptions: [], reminders: [] };
  try { parsed = JSON.parse(dec(json.content)); } catch {}
  return { sha: json.sha, subscriptions: parsed.subscriptions || [], reminders: parsed.reminders || [] };
}

export async function writeQueue({ subscriptions, reminders, sha }) {
  const body = {
    message: 'push: update queue',
    content: enc(JSON.stringify({ subscriptions, reminders, updatedAt: new Date().toISOString() }, null, 2)),
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  };
  const res = await fetch(url(), {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub write failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return json.content.sha;
}
