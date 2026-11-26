// Independent verification for radar-7 (adapted from the radar-6 verifier).
// Run: node verify-radar7.mjs
// Checks: board gates, coverage, data.js == board, page impliedOf() == board implied,
// per-category ranges, dated farm plans, dashboard/dossier size caps, no network
// strings in dashboard files, referral check, validation numbers.
import { readFileSync, readdirSync, statSync } from 'node:fs';

const REPO = '/home/hatch/workspace/makefun/token-radar-01-repo';
const SNAP = '/home/hatch/workspace/makefun/token-radar-01-kit-radar4/token-radar-01-kit/input/snapshot.json';
const snap = JSON.parse(readFileSync(SNAP, 'utf8'));
const board = JSON.parse(readFileSync(`${REPO}/out/board.json`, 'utf8')).rows;
const validation = JSON.parse(readFileSync(`${REPO}/out/validation.json`, 'utf8'));
const dossier = JSON.parse(readFileSync(`${REPO}/out/dossier.json`, 'utf8'));

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
}

// --- 1. board gates ---
check('board has 198 rows', board.length === 198, `got ${board.length}`);
check('ranks 1..198 exactly once', board.every((r, i) => r.rank === i + 1));
check('implied non-increasing by rank', board.every((r, i) => i === 0 || r.implied_value_usd <= board[i - 1].implied_value_usd));
check('all implied values distinct', new Set(board.map((r) => r.implied_value_usd)).size === board.length);
check('watchlist 40/40', snap.watchlist.every((s) => board.some((r) => r.slug === s)));
check('all rows pre-token', board.every((r) => r.token_status === 'pre-token'));
check('farm steps 3..12, 20..600 chars', board.every((r) => r.farm_steps.length >= 3 && r.farm_steps.length <= 12 && r.farm_steps.every((s) => s.length >= 20 && s.length <= 600)));
check('implied/value ranges valid', board.every((r) => Number.isSafeInteger(r.implied_value_usd) && r.implied_value_usd > 0 && r.value_low_usd > 0 && r.value_low_usd <= r.implied_value_usd && r.value_high_usd >= r.implied_value_usd));
check('probabilities in (0,1)', board.every((r) => r.issuance_probability > 0 && r.issuance_probability < 1));
check('expected = round(implied x prob)', board.every((r) => r.expected_value_usd === Math.max(1, Math.round(r.implied_value_usd * r.issuance_probability))));
check('model fields match radar-7 regression', board.every((r) => r.model.intercept === 6.9646 && r.model.slope === 0.5223));
check('implied = round(exp(fitted log mcap))', board.every((r) => r.implied_value_usd === Math.max(1, Math.round(Math.exp(r.model.fitted_log_mcap)))));
check('fitted log mcap = mean + shrink x (intercept + slope x log TVL - mean)',
  board.every((r) => Math.abs(r.model.fitted_log_mcap - (16.2136 + 0.9 * (6.9646 + 0.5223 * Math.log(r.tvl_usd) - 16.2136))) < 0.0002));
check('distinctness adjustments 0', validation.distinctness_adjustments === 0);
check('selected spec is pooled, shrink c=0.9', validation.candidates.selected_name === 'pooled, shrink c=0.9');
check('gate-proxy: shrink leads 15/43, runners-up 14/43',
  validation.candidates.gate_proxy.find((g) => g.name === 'pooled, shrink c=0.9')?.hits === 15 &&
  validation.candidates.gate_proxy.every((g) => g.name === 'pooled, shrink c=0.9' || g.hits <= 14));

// --- 2. coverage ---
const cov = JSON.parse(readFileSync(`${REPO}/out/data.js`, 'utf8').replace(/^window\.RADAR=/, '').replace(/;\s*$/, '')).coverage;
const accountedSlugs = new Set(cov.accounted.map((a) => a.slug));
const rankedSlugs = new Set(board.map((r) => r.slug));
check('coverage total 758', cov.total === 758);
check('coverage accounted_for 758', cov.accounted_for === 758);
check('coverage buckets 198/144/272/144', cov.ranked === 198 && cov.live_token === 144 && cov.token_on_record === 272 && cov.excluded === 144,
  `got ${cov.ranked}/${cov.live_token}/${cov.token_on_record}/${cov.excluded}`);
check('ranked + accounted slugs == snapshot slugs, no dupes',
  [...rankedSlugs].every((s) => !accountedSlugs.has(s)) &&
  rankedSlugs.size + accountedSlugs.size === 758 &&
  snap.protocols.every((p) => rankedSlugs.has(p.slug) || accountedSlugs.has(p.slug)));

// --- 3. data.js == board ---
const dataText = readFileSync(`${REPO}/out/data.js`, 'utf8');
const data = JSON.parse(dataText.replace(/^window\.RADAR=/, '').replace(/;\s*$/, ''));
check('data.js rows == board rows', data.rows.length === board.length);
check('data.js model is radar-7 regression', data.model_version === 'radar-7' && data.model.intercept === 6.9646 && data.model.slope === 0.5223 && data.model.shrink === 0.9 && data.model.mean_log_mcap === 16.2136);
const bySlug = new Map(board.map((r) => [r.slug, r]));
check('data.js row values == board row values', data.rows.every((d) => {
  const b = bySlug.get(d.slug);
  return b && d.rank === b.rank && d.implied_value_usd === b.implied_value_usd && d.value_low_usd === b.value_low_usd &&
    d.value_high_usd === b.value_high_usd && d.issuance_probability === b.issuance_probability &&
    d.expected_value_usd === b.expected_value_usd && d.log_tvl === b.model.log_tvl && d.fitted_log_mcap === b.model.fitted_log_mcap;
}));
check('data.js validation == validation.json', JSON.stringify(data.validation) === JSON.stringify(validation));

// --- 4. page impliedOf() == board implied for all rows ---
const appJs = readFileSync(`${REPO}/dashboard/app.js`, 'utf8');
const m = appJs.match(/function impliedOf\(row, model\) \{[\s\S]*?\n  \}/);
check('impliedOf found in shipped app.js', !!m);
if (m) {
  const impliedOf = eval(`(${m[0].replace('function impliedOf', 'function')})`);
  const mismatches = data.rows.filter((d) => impliedOf(d, data.model) !== d.implied_value_usd);
  check('page impliedOf() == board implied for all 198 rows', mismatches.length === 0, `${mismatches.length} mismatches`);
}

// --- 5. per-category ranges ---
const bandByCat = new Map(validation.ranges.per_category.map((b) => [b.category, b]));
check('7 categories have real (non-fallback) bands', validation.ranges.per_category.filter((b) => !b.fallback).length === 7,
  `got ${validation.ranges.per_category.filter((b) => !b.fallback).length}`);
check('global band is x0.294-x3.969', Math.abs(validation.ranges.low_factor - 0.294) < 0.001 && Math.abs(validation.ranges.high_factor - 3.969) < 0.001);
check('row low/high == implied x own-category band (global fallback where absent)', board.every((r) => {
  const b = bandByCat.get(r.category) ?? { low_factor: validation.ranges.low_factor, high_factor: validation.ranges.high_factor };
  return Math.abs(r.value_low_usd - Math.round(r.implied_value_usd * b.low_factor)) <= 1 &&
    Math.abs(r.value_high_usd - Math.round(r.implied_value_usd * b.high_factor)) <= 1;
}));
check('range honesty p50 LOO/WF24 within 0.40-0.55', validation.ranges.honesty.p50.loo >= 0.4 && validation.ranges.honesty.p50.loo <= 0.55 &&
  validation.ranges.honesty.p50.wf24 >= 0.4 && validation.ranges.honesty.p50.wf24 <= 0.55,
  `LOO ${validation.ranges.honesty.p50.loo} WF24 ${validation.ranges.honesty.p50.wf24}`);

// --- 6. dated farm plans ---
check('farm steps are dated (Day N: prefix, 6 steps)', board.every((r) => r.farm_steps.length === 6 && r.farm_steps.every((s, i) => i === 3 ? s.startsWith('Day 14, 21 and 28:') : /^Day \d+:/.test(s))));
check('farm steps start Day 0, weekly on Day 7, exit+log at the hold day (30/45/60)', board.every((r) => r.farm_steps[0].startsWith('Day 0:') && r.farm_steps[2].startsWith('Day 7:') && /Day (30|45|60):/.test(r.farm_steps[4]) && /Day (30|45|60):/.test(r.farm_steps[5])));
check('SKIP rows unwind on the hold day whether or not a token is announced',
  board.filter((r) => r.farm_verdict === 'SKIP').every((r) => r.farm_steps[4].includes('whether or not a token is announced')));
check('FARM/MARGINAL rows claim within 7 days of a token announcement',
  board.filter((r) => r.farm_verdict !== 'SKIP').every((r) => r.farm_steps[4].includes('within 7 days of the announcement')));
check('farm tiers 63/88/47', validation.farm.tiers.farm === 63 && validation.farm.tiers.marginal === 88 && validation.farm.tiers.skip === 47,
  `got ${JSON.stringify(validation.farm.tiers)}`);

// --- 7. size caps + hygiene ---
const dashFiles = readdirSync(`${REPO}/dashboard`);
const dashBytes = dashFiles.reduce((s, f) => s + statSync(`${REPO}/dashboard/${f}`).size, 0);
check('dashboard source <= 64KB', dashBytes <= 65536, `${dashBytes} bytes`);
const dossierText = dossier.text ?? '';
check('dossier text <= 65536 bytes', Buffer.byteLength(dossierText, 'utf8') <= 65536, `${Buffer.byteLength(dossierText, 'utf8')} bytes`);
check('dossier schema', dossier.schema === 'makefun/dossier/v1');
check('no http/https in dashboard files', dashFiles.every((f) => !/https?:\/\//.test(readFileSync(`${REPO}/dashboard/${f}`, 'utf8'))));
const codeText = ['lib/model.ts', 'main.ts', 'dashboard/app.js', 'dashboard/app.css', 'dashboard/index.html'].map((f) => readFileSync(`${REPO}/${f}`, 'utf8')).join('\n');
check('no old referral tvfbjxfd anywhere in repo code', !codeText.includes('tvfbjxfd') && !readFileSync(`${REPO}/README.md`, 'utf8').includes('tvfbjxfd'));
check('own referral yzjekwck in README footer', readFileSync(`${REPO}/README.md`, 'utf8').includes('yzjekwck'));
check('validation model_version radar-7', validation.model_version === 'radar-7');
check('validation LOO 83.87% / 42/128', Math.abs(validation.loo.median_abs_pct_error - 0.8387) < 0.001 && validation.loo.within_2x === 42);
check('validation WF25 89.98% / 11/31', Math.abs(validation.walk_forward.median_abs_pct_error - 0.8998) < 0.001 && validation.walk_forward.within_2x === 11);
check('validation WF24 89.2% / 16/43', Math.abs(validation.walk_forward_2024.median_abs_pct_error - 0.892) < 0.001 && validation.walk_forward_2024.within_2x === 16);
check('odds Brier WF25 0.2236 (base 0.3207)', Math.abs(validation.kpi.odds_brier_wf25 - 0.2236) < 0.001 && Math.abs(validation.kpi.odds_brier_wf25_base - 0.3207) < 0.001);
check('screenshots dir has 3 images', readdirSync(`${REPO}/out/screenshots`).length === 3);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
