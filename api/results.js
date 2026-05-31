import { createClient } from '@vercel/kv';
const kv = createClient({
  url: process.env.KV_OPEN_KV_REST_API_URL,
  token: process.env.KV_OPEN_KV_REST_API_TOKEN,
});

export const config = { runtime: 'edge' };

const DEFAULT_YEAR = 2026;

export default async function handler(request) {
  const url = new URL(request.url);
  const year = parseInt(url.searchParams.get('year') || '', 10) || DEFAULT_YEAR;
  const hkey = `${year}_trip_results`;

  if (request.method === 'GET') {
    const date = url.searchParams.get('date');
    const all = (await kv.hgetall(hkey)) || {};
    const parsed = {};
    Object.entries(all).forEach(([k, v]) => {
      parsed[k] = typeof v === 'string' ? JSON.parse(v) : v;
    });
    if (date) {
      const dateResults = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (k.startsWith(date + '__')) {
          dateResults[k] = v;
        }
      });
      return new Response(JSON.stringify(dateResults), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (request.method === 'POST') {
    const { date, flightId, matchKey, holes } = await request.json();
    if (!date || !flightId || !Array.isArray(holes)) {
      return new Response(JSON.stringify({ error: 'invalid' }), { status: 400 });
    }
    const key = `${date}__${flightId}${matchKey || ''}`;
    await kv.hset(hkey, { [key]: JSON.stringify({ holes }) });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
