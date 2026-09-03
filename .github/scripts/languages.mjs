// Generates .github/assets/languages.svg from the public repositories of one
// GitHub user. No dependencies. Deterministic: same input bytes → same output.
//
//   GITHUB_USER=aislamsilvalol-ctrl GITHUB_TOKEN=... node .github/scripts/languages.mjs
//
// The token is optional (public data); when present it only raises the rate limit.

import { writeFileSync } from "node:fs";

const user = process.env.GITHUB_USER ?? "aislamsilvalol-ctrl";
const out = process.env.OUT ?? ".github/assets/languages.svg";
const headers = { Accept: "application/vnd.github+json", "User-Agent": "profile-languages" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function json(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const repos = (await json(`https://api.github.com/users/${user}/repos?per_page=100&type=owner`))
  .filter((r) => !r.fork && !r.archived);

const totals = new Map();
for (const r of repos) {
  const langs = await json(r.languages_url);
  for (const [name, bytes] of Object.entries(langs)) totals.set(name, (totals.get(name) ?? 0) + bytes);
}

// Config files inflate byte counts without saying anything about the work.
for (const noise of ["Dockerfile", "Makefile", "Procfile", "Batchfile"]) totals.delete(noise);

const sum = [...totals.values()].reduce((a, b) => a + b, 0);
const rows = [...totals.entries()]
  .map(([name, bytes]) => [name, bytes / sum])
  .sort((a, b) => b[1] - a[1])
  .filter(([, share]) => share >= 0.005)
  .slice(0, 6);

const W = 640, PAD = 24, LABEL = 130, BAR_W = W - PAD * 2 - LABEL - 64, ROW_H = 26, TOP = 58;
const H = TOP + rows.length * ROW_H + 18;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const pct = (v) => `${(v * 100).toFixed(1)}%`;

const bars = rows
  .map(([name, share], i) => {
    const y = TOP + i * ROW_H;
    const w = Math.max(2, Math.round(BAR_W * share));
    const fill = i === 0 ? "#00FF66" : i === 1 ? "#5FCF8A" : "#3A3A37";
    return `    <text class="k" x="${PAD}" y="${y + 4}">${esc(name)}</text>
    <rect x="${PAD + LABEL}" y="${y - 6}" width="${BAR_W}" height="8" rx="2" fill="#151513"/>
    <rect x="${PAD + LABEL}" y="${y - 6}" width="${w}" height="8" rx="2" fill="${fill}"/>
    <text class="v" x="${W - PAD}" y="${y + 4}" text-anchor="end">${pct(share)}</text>`;
  })
  .join("\n");

const summary = rows.map(([n, s]) => `${n} ${pct(s)}`).join(", ");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
  <title id="t">Languages across public repositories</title>
  <desc id="d">Share of code by language: ${esc(summary)}.</desc>
  <style>
    text{font-family:'JetBrains Mono','IBM Plex Mono','Space Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,'DejaVu Sans Mono',monospace;font-size:13px}
    .h{fill:#5C5C57;font-size:11px;letter-spacing:2.5px}.k{fill:#9A9A94}.v{fill:#EDEDE8}.n{fill:#5C5C57;font-size:11px}
  </style>
  <rect width="${W}" height="${H}" rx="6" fill="#080808"/>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="6" fill="none" stroke="#1C1C1A"/>
  <text class="h" x="${PAD}" y="34">LANGUAGES · PUBLIC REPOSITORIES</text>
  <line x1="${PAD}" y1="44" x2="${W - PAD}" y2="44" stroke="#1C1C1A"/>
${bars}
</svg>
`;
writeFileSync(out, svg);
console.log(`wrote ${out}: ${summary}`);
