import { createClient } from '@vercel/kv';
const kv = createClient({
  url: process.env.KV_OPEN_KV_REST_API_URL,
  token: process.env.KV_OPEN_KV_REST_API_TOKEN,
});

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method === 'GET') {
    const all = (await kv.hgetall('trip_scorecards')) || {};
    const parsed = {};
    Object.entries(all).forEach(([k, v]) => {
      parsed[k] = typeof v === 'string' ? JSON.parse(v) : v;
    });
    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (request.method === 'POST') {
    const { player, date, holes } = await request.json();
    if (!player || !date || !Array.isArray(holes)) {
      return new Response(JSON.stringify({ error: 'invalid' }), { status: 400 });
    }
    await kv.hset('trip_scorecards', { [`${player}__${date}`]: JSON.stringify(holes) });
    const totalStrokes = holes.reduce((sum, h) => sum + (h?.strokes || 0), 0);
    if (totalStrokes > 0) {
      await kv.hset('trip_stats', { [`${player}__score__${date}`]: totalStrokes });
    }
    return new Response(JSON.stringify({ ok: true, totalStrokes }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
