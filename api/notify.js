import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const sinceParam = request.nextUrl.searchParams.get('since');
    const since = sinceParam ? parseInt(sinceParam, 10) : Date.now() - 5000;

    // Get events from the sorted set (using score as timestamp)
    const events = await kv.zrangebyscore('game_events', since, Date.now() + 1000);

    const parsedEvents = events
      .map(e => {
        try {
          return JSON.parse(e);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return new Response(JSON.stringify({ events: parsedEvents, timestamp: Date.now() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
