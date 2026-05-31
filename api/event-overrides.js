import { createClient } from '@vercel/kv';
const kv = createClient({
  url: process.env.KV_OPEN_KV_REST_API_URL,
  token: process.env.KV_OPEN_KV_REST_API_TOKEN,
});

export const config = { runtime: 'edge' };

const DEFAULT_YEAR = 2026;

// Stores per-year overrides for schedule + courses on top of the static data/<year>.json.
// KV key: `<year>_trip_event_overrides`.
// Body shape: { schedule?: {...}, courses?: [...] }

function keyFor(url) {
  const year = parseInt(new URL(url).searchParams.get('year') || '', 10) || DEFAULT_YEAR;
  return `${year}_trip_event_overrides`;
}

export default async function handler(request) {
  const hkey = keyFor(request.url);

  if (request.method === 'GET') {
    const data = (await kv.hgetall(hkey)) || {};
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      out[k] = typeof v === 'string' ? JSON.parse(v) : v;
    }
    return new Response(JSON.stringify(out), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const updates = {};
    if (body.schedule && typeof body.schedule === 'object') updates.schedule = JSON.stringify(body.schedule);
    if (Array.isArray(body.courses)) updates.courses = JSON.stringify(body.courses);
    if (!Object.keys(updates).length) {
      return new Response(JSON.stringify({ error: 'no schedule or courses' }), { status: 400 });
    }
    await kv.hset(hkey, updates);
    return new Response(JSON.stringify({ ok: true, fields: Object.keys(updates) }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
