// Keep historical daily counts: npm's downloads API only retains 18 months.
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const packageName = 'dsh-model-context-catalog';
const badgeDirectory = new URL('../.github/badges/', import.meta.url);
const statePath = new URL('npm-downloads.json', badgeDirectory);
const dayMilliseconds = 86_400_000;
const dateString = (time) => new Date(time).toISOString().slice(0, 10);
async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
}

const metadata = await getJson(`https://registry.npmjs.org/${packageName}`);
const firstDay = metadata.time.created.slice(0, 10);
const today = Date.parse(dateString(Date.now()));
const lastDay = dateString(today - dayMilliseconds);
let state = { package: packageName, firstDay, daily: {} };
try {
  state = JSON.parse(await readFile(statePath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (state.package !== packageName || state.firstDay !== firstDay) {
  throw new Error('Download history does not match the published package');
}

// Refresh a year of recent counts to pick up revisions without losing older days.
const startDay = dateString(Math.max(Date.parse(firstDay), today - 365 * dayMilliseconds));
const statistics = await getJson(
  `https://api.npmjs.org/downloads/range/${startDay}:${lastDay}/${packageName}`,
);
if (statistics.start !== startDay || statistics.end !== lastDay || !Array.isArray(statistics.downloads)) {
  throw new Error('npm returned an incomplete statistics interval');
}
for (const { day, downloads } of statistics.downloads) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isSafeInteger(downloads) || downloads < 0) {
    throw new Error('Invalid daily download count');
  }
  state.daily[day] = downloads;
}
let total = 0;
for (let time = Date.parse(firstDay); time < today; time += dayMilliseconds) {
  const day = dateString(time);
  if (!Number.isSafeInteger(state.daily[day]) || state.daily[day] < 0) {
    throw new Error(`Missing historical count for ${day}; refusing to label a partial count as total`);
  }
  total += state.daily[day];
}
const count = total.toLocaleString('en-US');
const label = 'npm 总下载量';
const labelWidth = 105;
const valueWidth = Math.max(40, count.length * 7 + 16);
const width = labelWidth + valueWidth;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${count}">
  <title>${label}: ${count}（累计至 ${lastDay}）</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#r)"><rect width="${labelWidth}" height="20" fill="#555"/><rect x="${labelWidth}" width="${valueWidth}" height="20" fill="#4c1"/><rect width="${width}" height="20" fill="url(#s)"/></g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Arial,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text><text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${count}</text><text x="${labelWidth + valueWidth / 2}" y="14">${count}</text>
  </g>
</svg>
`;
await mkdir(badgeDirectory, { recursive: true });
await writeFile(statePath, `${JSON.stringify({ ...state, through: lastDay, total }, null, 2)}\n`);
await writeFile(new URL('npm-downloads.svg', badgeDirectory), svg);
console.log(`${label}: ${count}, ${firstDay} through ${lastDay}`);
