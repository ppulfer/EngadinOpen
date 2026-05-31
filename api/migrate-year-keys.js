import { createClient } from '@vercel/kv';
const kv = createClient({
  url: process.env.KV_OPEN_KV_REST_API_URL,
  token: process.env.KV_OPEN_KV_REST_API_TOKEN,
});

export const config = { runtime: 'edge' };

const LEGACY_TO_YEARED = [
  ['trip_players',          '2026_trip_players'],
  ['trip_scorecards',       '2026_trip_scorecards'],
  ['trip_stats',            '2026_trip_stats'],
  ['trip_results',          '2026_trip_results'],
  ['trip_event_overrides',  '2026_trip_event_overrides'],
];

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const overwrite = url.searchParams.get('overwrite') === '1';

  const report = [];

  for (const [src, dst] of LEGACY_TO_YEARED) {
    const srcData = (await kv.hgetall(src)) || {};
    const srcCount = Object.keys(srcData).length;

    if (srcCount === 0) {
      report.push({ src, dst, srcCount: 0, action: 'skip-empty' });
      continue;
    }

    const dstData = (await kv.hgetall(dst)) || {};
    const dstCount = Object.keys(dstData).length;

    if (dstCount > 0 && !overwrite) {
      report.push({ src, dst, srcCount, dstCount, action: 'skip-dst-exists (use ?overwrite=1 to force)' });
      continue;
    }

    if (dryRun) {
      report.push({ src, dst, srcCount, dstCount, action: 'dry-run' });
      continue;
    }

    await kv.hset(dst, srcData);
    report.push({ src, dst, srcCount, dstCount, action: 'copied' });
  }

  return new Response(JSON.stringify({ ok: true, dryRun, overwrite, report }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
