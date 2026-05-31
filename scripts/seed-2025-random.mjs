// One-off seed script: generates random 2025 scorecards via POST /api/scores?year=2025.
// Köbi wins (lowest brutto total — HCPs are all 0).

const API = process.env.API_BASE || 'https://engadin-open-2026.vercel.app';

const ROUND_DATES = ['2025-07-17', '2025-07-18', '2025-07-19', '2025-07-20'];

const COURSES = {
  zuoz:    [4,5,4,3,4,4,5,3,4, 4,4,4,5,3,4,3,5,4],
  samedan: [4,5,5,4,4,4,3,4,4, 3,4,4,5,4,3,4,3,5],
};
const ROUND_COURSE = { '2025-07-17':'zuoz', '2025-07-18':'samedan', '2025-07-19':'samedan', '2025-07-20':'zuoz' };

// Target totals per player per round. Köbi wins comfortably.
const TARGETS = {
  koelbener:   [74, 73, 75, 74],
  mansour:     [77, 78, 76, 77],
  hartmann:    [79, 78, 77, 78],
  parli:       [79, 80, 78, 79],
  isaak:       [81, 80, 80, 80],
  laenzlinger: [82, 81, 83, 81],
  hodgskin:    [83, 84, 82, 83],
  pulfer:      [85, 84, 86, 84],
};

function rand(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rand(arr.length)]; }

function generateHoles(pars, totalStrokes) {
  const targetDiff = totalStrokes - pars.reduce((a, b) => a + b, 0);
  const diffs = new Array(18).fill(0);

  // Sprinkle in 1-2 birdies for color.
  const birdies = Math.min(2, Math.max(0, Math.floor(targetDiff / 4)));
  for (let i = 0; i < birdies; i++) {
    let h;
    do { h = rand(18); } while (diffs[h] !== 0);
    diffs[h] = -1;
  }

  let remaining = targetDiff + birdies;
  while (remaining > 0) {
    const h = rand(18);
    if (diffs[h] < 3) { diffs[h]++; remaining--; }
  }

  return pars.map((par, i) => {
    const strokes = par + diffs[i];
    let putts;
    if (diffs[i] <= -1)      putts = pick([1, 1, 2]);
    else if (diffs[i] === 0) putts = pick([1, 2, 2, 2]);
    else if (diffs[i] === 1) putts = pick([1, 2, 2, 3]);
    else                     putts = pick([2, 2, 3, 3]);
    putts = Math.min(putts, Math.max(1, strokes - 1));
    const lostBalls = Math.random() < 0.04 ? 1 : 0;
    return { strokes, putts, lostBalls };
  });
}

async function postScore(player, date, holes) {
  const res = await fetch(`${API}/api/scores?year=2025`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player, date, holes }),
  });
  if (!res.ok) throw new Error(`POST ${player}/${date} → ${res.status}`);
  return res.json();
}

(async () => {
  const summary = [];
  for (const [player, totals] of Object.entries(TARGETS)) {
    let grand = 0;
    for (let r = 0; r < ROUND_DATES.length; r++) {
      const date = ROUND_DATES[r];
      const pars = COURSES[ROUND_COURSE[date]];
      const holes = generateHoles(pars, totals[r]);
      const actual = holes.reduce((s, h) => s + h.strokes, 0);
      grand += actual;
      await postScore(player, date, holes);
      process.stdout.write(`  ${player.padEnd(12)} ${date}: ${actual}\n`);
    }
    summary.push({ player, total: grand });
  }
  summary.sort((a, b) => a.total - b.total);
  console.log('\n=== Final standings ===');
  summary.forEach((s, i) => console.log(`${i + 1}. ${s.player.padEnd(12)} ${s.total}`));
})();
