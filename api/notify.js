import { createClient } from '@vercel/kv';
const kv = createClient({
  url: process.env.KV_OPEN_KV_REST_API_URL,
  token: process.env.KV_OPEN_KV_REST_API_TOKEN,
});

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const sinceParam = url.searchParams.get('since');
    const since = sinceParam ? parseInt(sinceParam, 10) : Date.now() - 600000; // 10 minutes

    let events = [];
    try {
      console.log('NOTIFY_START', { since });

      // Single range query instead of keys() + N individual gets
      const members = await kv.zrange('events', since, '+inf', { byScore: true });

      if (members && members.length > 0) {
        events = members
          .map(m => {
            try {
              return typeof m === 'string' ? JSON.parse(m) : m;
            } catch (e) {
              console.error('PARSE_ERROR', e.message);
              return null;
            }
          })
          .filter(Boolean)
          .sort((a, b) => b.timestamp - a.timestamp);
      }

      console.log('EVENTS_FETCHED', { count: events.length, since });
    } catch (kvError) {
      console.error('KV_ERROR', kvError.message);
    }

    const response = { events: events || [], timestamp: Date.now() };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Notify handler error:', error);
    return new Response(JSON.stringify({ events: [], timestamp: Date.now() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
