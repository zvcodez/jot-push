const ALLOWED_ORIGIN = 'https://zvcodez.github.io';

export function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Jot-Token');
  return res;
}

export function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    withCors(res).status(204).end();
    return true;
  }
  return false;
}

export function checkToken(req, res) {
  if (req.headers['x-jot-token'] !== process.env.JOT_API_TOKEN) {
    withCors(res).status(401).json({ error: 'Invalid token' });
    return false;
  }
  return true;
}
