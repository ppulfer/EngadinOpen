import { createClient } from '@vercel/kv';
const kv = createClient({
  url: process.env.KV_OPEN_KV_REST_API_URL,
  token: process.env.KV_OPEN_KV_REST_API_TOKEN,
});

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method === 'GET') {
    const all = (await kv.hgetall('trip_players')) || {};
    const players = Object.entries(all).map(([key, v]) => {
      const p = typeof v === 'string' ? JSON.parse(v) : v;
      return { key, ...p };
    });
    players.sort((a, b) => a.name.localeCompare(b.name));
    return new Response(JSON.stringify(players), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const { action, key } = body;

    if (action === 'set') {
      const { name, hcp, nickname, feature } = body;
      if (!key || !name) return new Response(JSON.stringify({ error: 'key and name required' }), { status: 400 });
      const player = {
        name,
        hcp: parseFloat(hcp) || 0,
        nickname: nickname || name.split(' ')[0],
        feature: feature || '',
      };
      await kv.hset('trip_players', { [key]: JSON.stringify(player) });
      return new Response(JSON.stringify({ ok: true, key, ...player }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      if (!key) return new Response(JSON.stringify({ error: 'key required' }), { status: 400 });
      await kv.hdel('trip_players', key);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400 });
  }

  return new Response('Method not allowed', { status: 405 });
}
