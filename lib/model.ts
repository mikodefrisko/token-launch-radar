// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// radar-3. The model is FIT to the snapshot instead of asserted: every value term is chosen by a
// grid search on leave-one-out predictions over the tokenized protocols, and the fit is reported
// honestly, including where it is weak (see `validateModel` and VALIDATION-radar3.md).
//
//   multiple     = median(mcap_usd / tvl_usd) over tokenized comps in the protocol's category
//                  (n >= 3 after leaving the protocol itself out), else the snapshot-wide median;
//                  clamped to [0.05, 1.00]
//   growth       = clamp(change_7d, -60, 120) per cent
//   growthMult   = 1 + (growth / 100) x GROWTH_WEIGHT        (fitted; see fitModel)
//   maturity     = MATURITY_FLOOR + min(age_days, 1095) / 1095 x MATURITY_RANGE   (fitted)
//   implied      = max(1, round(tvl_usd x multiple x growthMult x maturity))
//
// The grid search minimises the median absolute log error of leave-one-out predictions
// (implied vs actual market cap) over the 128 tokenized protocols with a usable market cap
// (144 record one; 16 record 0 or -1 and cannot form a ratio). The objective is FLAT in the
// growth weight — 1.569 at weight 0.0, 1.615 at 0.5, 1.678 at 1.0 — so no growth weight is
// distinguishable from any other at n = 128. The selection rule is therefore: among grid
// settings within 5% of the best median absolute log error, take the one closest to the
// radar-2 prior (growth 0.5, maturity floor 0.6, maturity range 0.4). That selects
// growth 0.5, maturity floor 0.8, maturity range 0.4: the growth term is kept because the
// data cannot reject it, and maturity is fitted (0.8/0.4 beats 0.6/0.4 by ~6%).
// The fitted model is still weak in absolute terms — leave-one-out median absolute error
// ~92%, only ~20% of predictions within 2x of the actual market cap — and the value ranges
// below are taken from that error distribution, not invented.
//
// A protocol is pre-token when its index entry records no token (no market cap, no CoinGecko
// id, no symbol). The board ranks every pre-token protocol the house's own watchlist rule
// would keep: not a centralised exchange, not a Bridge / Canonical Bridge / Liquid Staking /
// Liquid Restaking / Restaked BTC product, not a versioned pool, not a wrapped / staked /
// staking product, and not named for an exchange. That is the whole honest set — 198 rows —
// and every other protocol is accounted for, not dropped: live-token protocols (144, with
// their market caps), protocols that record a token but no market cap (272), and pre-token
// protocols the house rule excludes (144). 198 + 144 + 272 + 144 = 758.
//
// Ranking: the board's ranks are by implied value, because the gate requires implied value
// not to rise as rank ascends. Each row also carries an issuance probability and an expected
// value (implied x probability); the dashboard sorts by expected value too. The probability
// is the empirical, shrunk share of protocols in the row's age x TVL cohort that record a
// token in this snapshot — a record share, not a forecast, and never a promise a token launches.
//
// Ranges: value_low_usd / value_high_usd are the implied value times the 25th / 75th
// percentile of (actual mcap / leave-one-out implied) over the tokenized protocols — the
// middle 50% of outcomes. They are wide because the model is weak; that width is the point.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  multiple_floor: number;
  multiple_cap: number;
  min_comps: number;
}

/** radar-2's constants: the prior the fitted selection is shrunk towards, not the shipped model. */
export const PRIOR_MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  multiple_floor: 0.05,
  multiple_cap: 1.0,
  min_comps: 3,
};

/** The grid the fit searches: growth weights, maturity floors, maturity ranges. */
export const FIT_GRID = {
  growth_weights: [0, 0.25, 0.5, 0.75, 1.0],
  maturity_floors: [0.6, 0.8, 1.0],
  maturity_ranges: [0, 0.2, 0.4],
  /** How far above the best median absolute log error a setting may sit and still count as tied. */
  tie_band: 0.05,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  value_low_usd: number;
  value_high_usd: number;
  issuance_probability: number;
  issuance_cohort: string;
  expected_value_usd: number;
  model: {
    category_multiple: number;
    category_comps: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  value_low_usd: number;
  value_high_usd: number;
  issuance_probability: number;
  issuance_cohort: string;
  expected_value_usd: number;
  multiple: number;
  multiple_n: number;
  watchlist: boolean;
  growth_multiplier: number;
  maturity_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  symbol: string | null;
}

/** One protocol the board does not rank, with the reason it is accounted for instead. */
export interface AccountedRow {
  slug: string;
  name: string;
  reason: 'live-token' | 'token-on-record' | 'excluded';
  detail: string;
}

/** How the board accounts for every protocol in the snapshot. */
export interface Coverage {
  total: number;
  ranked: number;
  live_token: number;
  token_on_record: number;
  excluded: number;
  accounted_for: number;
  accounted: AccountedRow[];
}

/** One age x TVL cohort's token-record share, raw and shrunk towards the overall rate. */
export interface CohortRow {
  age_bucket: string;
  tvl_bucket: string;
  n: number;
  tokenized: number;
  raw_rate: number;
  probability: number;
}

/** The fit and its blind tests, as the dashboard shows them and validation.json carries them. */
export interface Validation {
  model_version: string;
  fit_set: { tokenized_with_mcap: number; usable_for_fit: number; excluded_mcap_le_zero: number };
  grid: {
    growth_weights: number[];
    maturity_floors: number[];
    maturity_ranges: number[];
    tie_band: number;
    best_median_abs_log_error: number;
    best_params: { growth_weight: number; maturity_floor: number; maturity_range: number };
    selected_params: { growth_weight: number; maturity_floor: number; maturity_range: number };
    selection_rule: string;
    table: { growth_weight: number; maturity_floor: number; maturity_range: number; median_abs_log_error: number }[];
  };
  loo: {
    n: number;
    median_abs_pct_error: number;
    mean_abs_pct_error: number;
    median_abs_log_error: number;
    within_2x: number;
    within_2x_pct: number;
    ratio_q10: number;
    ratio_q25: number;
    ratio_q50: number;
    ratio_q75: number;
    ratio_q90: number;
  };
  walk_forward: {
    cutoff: string;
    fit_n: number;
    test_n: number;
    excluded_null_listed: number;
    median_abs_pct_error: number;
    mean_abs_pct_error: number;
    within_2x: number;
    within_2x_pct: number;
  };
  walk_forward_2024: {
    cutoff: string;
    fit_n: number;
    test_n: number;
    excluded_null_listed: number;
    median_abs_pct_error: number;
    mean_abs_pct_error: number;
    within_2x: number;
    within_2x_pct: number;
  };
  ranges: { low_factor: number; high_factor: number; method: string };
  issuance: { shrinkage_m: number; overall_rate: number; cohorts: CohortRow[] };
  distinctness_adjustments: number;
}

/** Everything the dashboard needs: the board, the live set, the accounting, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  overall_multiple: number;
  multiples: Record<string, number>;
  rows: RadarRow[];
  live: LiveRow[];
  coverage: Coverage;
  validation: Validation;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a list, or 0 when it holds nothing. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A quantile by linear interpolation, the way the analysis script computes it. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.min(lo + 1, sorted.length - 1);
  const f = i - lo;
  return sorted[lo]! * (1 - f) + sorted[hi]! * f;
}

/** The median of a sorted list with one occurrence of `value` removed, or 0 when nothing is left. */
function medianExcluding(sorted: number[], value: number): number {
  const rest = [...sorted];
  const at = rest.indexOf(value);
  if (at >= 0) rest.splice(at, 1);
  return median(rest);
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round3 = (n: number): number => Math.round(n * 1e3) / 1e3;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The tokenized protocols that can be fitted: a positive market cap and a positive TVL. */
export function fitSet(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

/** Sorted market-cap/TVL ratios per category and overall, for leave-one-out medians. */
interface FitComps {
  byCategory: Map<string, number[]>;
  all: number[];
}

function buildFitComps(pool: SnapshotProtocol[]): FitComps {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of pool) {
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) {
      const ratio = p.mcap_usd / p.tvl_usd;
      all.push(ratio);
      if (p.category !== null) {
        const arr = byCategory.get(p.category) ?? [];
        arr.push(ratio);
        byCategory.set(p.category, arr);
      }
    }
  }
  for (const arr of byCategory.values()) arr.sort((a, b) => a - b);
  all.sort((a, b) => a - b);
  return { byCategory, all };
}

/**
 * The category multiple one tokenized protocol gets with ITSELF LEFT OUT: the median of its
 * category's ratios without its own ratio (used only when at least three comps remain), else
 * the snapshot-wide median without its own ratio. Clamped to [multiple_floor, multiple_cap].
 */
export function looMultiple(
  protocol: SnapshotProtocol,
  comps: FitComps,
  model: ModelConstants = PRIOR_MODEL,
): { multiple: number; comps: number } {
  const clamp = (n: number): number => Math.min(model.multiple_cap, Math.max(model.multiple_floor, n));
  if (protocol.mcap_usd === null || protocol.tvl_usd <= 0) return { multiple: clamp(median(comps.all)), comps: 0 };
  const own = protocol.mcap_usd / protocol.tvl_usd;
  const overall = clamp(medianExcluding(comps.all, own));
  if (protocol.category === null) return { multiple: overall, comps: 0 };
  const cat = comps.byCategory.get(protocol.category) ?? [];
  const remaining = cat.length - 1;
  if (remaining >= model.min_comps) {
    return { multiple: clamp(medianExcluding(cat, own)), comps: remaining };
  }
  return { multiple: overall, comps: remaining };
}

/**
 * The category multiples, derived from the snapshot itself: for each category, the median
 * market-cap-to-TVL ratio of its tokenized protocols (mcap and TVL both positive), when at least
 * `model.min_comps` of them exist; otherwise the snapshot-wide median. Every multiple is clamped
 * to [multiple_floor, multiple_cap]. `counts` names how many tokenized comps each category had.
 * Used for the shipped board (full sample) and for walk-forward training pools.
 */
export function categoryMultiples(
  pool: SnapshotProtocol[],
  model: ModelConstants = PRIOR_MODEL,
): { multiples: Record<string, number>; counts: Record<string, number>; overall: number } {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of pool) {
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) {
      const ratio = p.mcap_usd / p.tvl_usd;
      all.push(ratio);
      if (p.category !== null) {
        const arr = byCategory.get(p.category) ?? [];
        arr.push(ratio);
        byCategory.set(p.category, arr);
      }
    }
  }
  const clamp = (n: number): number => Math.min(model.multiple_cap, Math.max(model.multiple_floor, n));
  const overall = clamp(median(all));
  const multiples: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const [category, ratios] of byCategory) {
    counts[category] = ratios.length;
    multiples[category] = ratios.length >= model.min_comps ? clamp(median(ratios)) : overall;
  }
  return { multiples, counts, overall };
}

/** The category multiple one protocol gets, and how many comps stood behind it. */
export function multipleFor(
  protocol: SnapshotProtocol,
  comps: { multiples: Record<string, number>; counts: Record<string, number>; overall: number },
): { multiple: number; comps: number } {
  if (protocol.category !== null && protocol.category in comps.multiples) {
    return { multiple: comps.multiples[protocol.category]!, comps: comps.counts[protocol.category] ?? 0 };
  }
  return { multiple: comps.overall, comps: 0 };
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  multiple: number,
  model: ModelConstants = PRIOR_MODEL,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  // The multiple is stored rounded to four decimals, and the implied value is computed from that
  // rounded figure, so the board, the dashboard data and the page's recompute all agree exactly.
  const mult = Math.round(multiple * 1e4) / 1e4;
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * mult * growthMult * maturityMult));
  return { implied, growthPct, growthMult, maturityMult, age };
}

/** Leave-one-out predictions for the fit set under `model`: implied vs actual market cap. */
function looPredictions(
  snapshot: Snapshot,
  model: ModelConstants,
): { protocol: SnapshotProtocol; implied: number; actual: number }[] {
  const pool = fitSet(snapshot);
  const comps = buildFitComps(pool);
  return pool.map((p) => {
    const { multiple } = looMultiple(p, comps, model);
    const { implied } = impliedValue(p, snapshot.as_of, multiple, model);
    return { protocol: p, implied, actual: p.mcap_usd! };
  });
}

/** Error statistics for a list of (implied, actual) pairs. */
function errorStats(pairs: { implied: number; actual: number }[]): {
  median_abs_pct_error: number;
  mean_abs_pct_error: number;
  median_abs_log_error: number;
  within_2x: number;
  within_2x_pct: number;
  ratios_sorted: number[];
} {
  const apes = pairs.map(({ implied, actual }) => Math.abs(implied / actual - 1));
  const logs = pairs.map(({ implied, actual }) => Math.abs(Math.log(implied / actual)));
  const ratios = pairs.map(({ implied, actual }) => actual / implied).sort((a, b) => a - b);
  const within = pairs.filter(({ implied, actual }) => implied / actual >= 0.5 && implied / actual <= 2).length;
  return {
    median_abs_pct_error: round4(median(apes)),
    mean_abs_pct_error: round4(apes.reduce((a, b) => a + b, 0) / Math.max(1, apes.length)),
    median_abs_log_error: round4(median(logs)),
    within_2x: within,
    within_2x_pct: round4(within / Math.max(1, pairs.length)),
    ratios_sorted: ratios,
  };
}

/**
 * The fit: grid-search growth weight, maturity floor and maturity range on leave-one-out
 * median absolute log error, then select within a 5% tie band the setting closest to the
 * radar-2 prior (growth 0.5, maturity floor 0.6, maturity range 0.4) — the objective is flat
 * in the growth weight, so chasing the argmin would chase noise. Returns the fitted constants.
 */
export function fitModel(snapshot: Snapshot): {
  model: ModelConstants;
  grid: { growth_weight: number; maturity_floor: number; maturity_range: number; median_abs_log_error: number }[];
  best: { growth_weight: number; maturity_floor: number; maturity_range: number; median_abs_log_error: number };
  selected: { growth_weight: number; maturity_floor: number; maturity_range: number; median_abs_log_error: number };
} {
  const grid: { growth_weight: number; maturity_floor: number; maturity_range: number; median_abs_log_error: number }[] = [];
  for (const gw of FIT_GRID.growth_weights) {
    for (const mf of FIT_GRID.maturity_floors) {
      for (const mr of FIT_GRID.maturity_ranges) {
        const trial: ModelConstants = { ...PRIOR_MODEL, growth_weight: gw, maturity_floor: mf, maturity_range: mr };
        const stats = errorStats(looPredictions(snapshot, trial));
        grid.push({ growth_weight: gw, maturity_floor: mf, maturity_range: mr, median_abs_log_error: stats.median_abs_log_error });
      }
    }
  }
  const sorted = [...grid].sort((a, b) => a.median_abs_log_error - b.median_abs_log_error);
  const best = sorted[0]!;
  const band = best.median_abs_log_error * (1 + FIT_GRID.tie_band);
  const tied = grid.filter((g) => g.median_abs_log_error <= band);
  const dist2 = (g: { growth_weight: number; maturity_floor: number; maturity_range: number }): number =>
    (g.growth_weight - PRIOR_MODEL.growth_weight) ** 2 +
    (g.maturity_floor - PRIOR_MODEL.maturity_floor) ** 2 +
    (g.maturity_range - PRIOR_MODEL.maturity_range) ** 2;
  tied.sort((a, b) => dist2(a) - dist2(b) || a.median_abs_log_error - b.median_abs_log_error);
  const selected = tied[0]!;
  const model: ModelConstants = {
    ...PRIOR_MODEL,
    growth_weight: selected.growth_weight,
    maturity_floor: selected.maturity_floor,
    maturity_range: selected.maturity_range,
  };
  return { model, grid, best, selected };
}

/** A blind walk-forward test: fit multiples on protocols listed before `cutoff`, test after it. */
function walkForward(
  snapshot: Snapshot,
  model: ModelConstants,
  cutoff: string,
): { cutoff: string; fit_n: number; test_n: number; excluded_null_listed: number; median_abs_pct_error: number; mean_abs_pct_error: number; within_2x: number; within_2x_pct: number } {
  const pool = fitSet(snapshot);
  const fitPool = pool.filter((p) => p.listed_at !== null && p.listed_at < cutoff);
  const testPool = pool.filter((p) => p.listed_at !== null && p.listed_at >= cutoff);
  const excluded = pool.filter((p) => p.listed_at === null).length;
  const comps = categoryMultiples(fitPool, model);
  const pairs = testPool.map((p) => {
    const { multiple } = multipleFor(p, comps);
    const { implied } = impliedValue(p, snapshot.as_of, multiple, model);
    return { implied, actual: p.mcap_usd! };
  });
  const stats = errorStats(pairs);
  return {
    cutoff,
    fit_n: fitPool.length,
    test_n: testPool.length,
    excluded_null_listed: excluded,
    median_abs_pct_error: stats.median_abs_pct_error,
    mean_abs_pct_error: stats.mean_abs_pct_error,
    within_2x: stats.within_2x,
    within_2x_pct: stats.within_2x_pct,
  };
}

/** The age bucket of a protocol: its listed age, or unknown when DefiLlama names no date. */
function ageBucket(age: number | null): string {
  if (age === null) return 'unknown';
  if (age < 365) return '<1y';
  if (age < 730) return '1-2y';
  if (age < 1095) return '2-3y';
  return '3y+';
}

/** The TVL bucket of a protocol. */
function tvlBucket(tvl: number): string {
  if (tvl < 10_000_000) return '<$10M';
  if (tvl < 50_000_000) return '$10-50M';
  if (tvl < 250_000_000) return '$50-250M';
  return '$250M+';
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * The empirical token-record share by age x TVL cohort, shrunk towards the overall rate
 * (20 pseudo-counts) so small cohorts do not swing to 0 or 1 on a handful of protocols.
 * The outcome is "records a token" (a CoinGecko id or a symbol on record), not "has a
 * market cap": 272 protocols record a token symbol with no market-cap figure in the snapshot.
 */
export function issuanceCohorts(snapshot: Snapshot): { cohorts: CohortRow[]; overall_rate: number; shrinkage_m: number } {
  const shrinkage_m = 20;
  const total = snapshot.protocols.length;
  const tokenized = snapshot.protocols.filter((p) => !isPreToken(p)).length;
  const overall_rate = round4(tokenized / Math.max(1, total));
  const byCohort = new Map<string, { n: number; tokenized: number }>();
  for (const p of snapshot.protocols) {
    const key = `${ageBucket(ageDays(snapshot.as_of, p.listed_at))}|${tvlBucket(p.tvl_usd)}`;
    const c = byCohort.get(key) ?? { n: 0, tokenized: 0 };
    c.n += 1;
    if (!isPreToken(p)) c.tokenized += 1;
    byCohort.set(key, c);
  }
  const cohorts: CohortRow[] = [...byCohort.entries()]
    .map(([key, c]) => {
      const [age_bucket, tvl_bucket] = key.split('|');
      const raw = c.tokenized / c.n;
      const shrunk = (c.tokenized + shrinkage_m * overall_rate) / (c.n + shrinkage_m);
      return {
        age_bucket: age_bucket!,
        tvl_bucket: tvl_bucket!,
        n: c.n,
        tokenized: c.tokenized,
        raw_rate: round4(raw),
        probability: Math.round(shrunk * 100) / 100,
      };
    })
    .sort((a, b) => (a.age_bucket < b.age_bucket ? -1 : a.age_bucket > b.age_bucket ? 1 : a.tvl_bucket < b.tvl_bucket ? -1 : 1));
  return { cohorts, overall_rate, shrinkage_m };
}

/** A protocol's issuance cohort label and shrunk token-record probability. */
export function issuanceFor(
  protocol: SnapshotProtocol,
  asOf: string,
  cohorts: CohortRow[],
): { probability: number; cohort: string } {
  const label = `${ageBucket(ageDays(asOf, protocol.listed_at))} · ${tvlBucket(protocol.tvl_usd)}`;
  const row = cohorts.find((c) => `${c.age_bucket} · ${c.tvl_bucket}` === label);
  if (row === undefined) return { probability: 0.55, cohort: label };
  return { probability: row.probability, cohort: label };
}

/**
 * The whole validation: the grid search, leave-one-out errors, two blind walk-forward tests,
 * and the value-range factors from the leave-one-out error distribution.
 */
export function validateModel(snapshot: Snapshot, model: ModelConstants, fit: ReturnType<typeof fitModel>): Validation {
  const looPairs = looPredictions(snapshot, model);
  const loo = errorStats(looPairs);
  const wf = walkForward(snapshot, model, '2025-01-01');
  const wf24 = walkForward(snapshot, model, '2024-07-01');
  const low_factor = round3(quantile(loo.ratios_sorted, 0.25));
  const high_factor = round3(quantile(loo.ratios_sorted, 0.75));
  const cohorts = issuanceCohorts(snapshot);
  const tokenizedWithMcap = snapshot.protocols.filter((p) => p.mcap_usd !== null).length;
  return {
    model_version: MODEL_VERSION,
    fit_set: {
      tokenized_with_mcap: tokenizedWithMcap,
      usable_for_fit: fitSet(snapshot).length,
      excluded_mcap_le_zero: tokenizedWithMcap - fitSet(snapshot).length,
    },
    grid: {
      growth_weights: FIT_GRID.growth_weights,
      maturity_floors: FIT_GRID.maturity_floors,
      maturity_ranges: FIT_GRID.maturity_ranges,
      tie_band: FIT_GRID.tie_band,
      best_median_abs_log_error: fit.best.median_abs_log_error,
      best_params: { growth_weight: fit.best.growth_weight, maturity_floor: fit.best.maturity_floor, maturity_range: fit.best.maturity_range },
      selected_params: { growth_weight: fit.selected.growth_weight, maturity_floor: fit.selected.maturity_floor, maturity_range: fit.selected.maturity_range },
      selection_rule:
        'Grid-search leave-one-out median absolute log error over growth weight, maturity floor and maturity range; among settings within 5% of the best, take the one closest to the radar-2 prior (growth 0.5, maturity floor 0.6, maturity range 0.4), because the objective is flat in the growth weight.',
      table: [...fit.grid].sort((a, b) => a.median_abs_log_error - b.median_abs_log_error),
    },
    loo: {
      n: looPairs.length,
      median_abs_pct_error: loo.median_abs_pct_error,
      mean_abs_pct_error: loo.mean_abs_pct_error,
      median_abs_log_error: loo.median_abs_log_error,
      within_2x: loo.within_2x,
      within_2x_pct: loo.within_2x_pct,
      ratio_q10: round3(quantile(loo.ratios_sorted, 0.1)),
      ratio_q25: low_factor,
      ratio_q50: round3(quantile(loo.ratios_sorted, 0.5)),
      ratio_q75: high_factor,
      ratio_q90: round3(quantile(loo.ratios_sorted, 0.9)),
    },
    walk_forward: wf,
    walk_forward_2024: wf24,
    ranges: {
      low_factor,
      high_factor,
      method:
        'value_low_usd = implied x 25th percentile of (actual mcap / leave-one-out implied) over the 128 tokenized protocols; value_high_usd uses the 75th percentile. The range is the middle 50% of backtested outcomes, not a guess.',
    },
    issuance: { shrinkage_m: cohorts.shrinkage_m, overall_rate: cohorts.overall_rate, cohorts: cohorts.cohorts },
    distinctness_adjustments: 0,
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the house's watchlist rule excludes: wrapped, staked or bridged products. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Exchange names the house's watchlist rule excludes at the start of a protocol's name. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** A whole word wrapped, staked or staking anywhere in a name. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/**
 * Whether a protocol is one the board may rank: pre-token AND kept by the house's watchlist
 * rule — not an exchange, not a wrapped / staked / bridged product, not a versioned pool, not
 * named for an exchange. The rule is the snapshot's own; no protocol name is special-cased.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((e) => p.name.startsWith(e))) return false;
  return true;
}

/** Why a pre-token protocol the board does not rank is excluded, in the house rule's words. */
export function exclusionReason(p: SnapshotProtocol): string {
  if (p.category === 'CEX') return 'centralised exchange';
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return 'wrapped, staked or bridged product';
  if (VERSIONED.test(p.name)) return 'versioned pool of another protocol';
  if (WRAPPED_WORD.test(p.name)) return 'wrapped, staked or bridged product';
  if (EXCHANGE_PREFIXES.some((e) => p.name.startsWith(e))) return 'named for an exchange';
  return 'excluded by the watchlist rule';
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(
  snapshot: Snapshot,
  model: ModelConstants,
  validation: Validation,
): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const comps = categoryMultiples(snapshot.protocols, model);
  const cohorts = issuanceCohorts(snapshot);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol, at any TVL — the watchlist floor is a floor,
  // never a ceiling, and the house rule (not a TVL bar) decides what may rank.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const lowFactor = validation.ranges.low_factor;
  const highFactor = validation.ranges.high_factor;
  const scored = [...chosen.values()].map((p) => {
    const { multiple, comps: n } = multipleFor(p, comps);
    const { implied, growthPct, growthMult, maturityMult, age } = impliedValue(p, snapshot.as_of, multiple, model);
    const { probability, cohort } = issuanceFor(p, snapshot.as_of, cohorts.cohorts);
    return { p, implied, multiple, comps: n, growthPct, growthMult, maturityMult, age, probability, cohort };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // The gate needs every implied value distinct and non-increasing by rank. Whole-dollar rounding
  // can tie two rows; when it does, step the lower one down by $1 (and its range and expected value
  // with it) so the ranking stays a ranking. Counted, so the validation says how often it fired.
  let adjustments = 0;
  for (let i = 1; i < scored.length; i++) {
    if (scored[i]!.implied >= scored[i - 1]!.implied) {
      scored[i]!.implied = scored[i - 1]!.implied - 1;
      adjustments += 1;
    }
  }
  validation.distinctness_adjustments = adjustments;
  return scored.map((s, i) => {
    const low = Math.max(1, Math.round(s.implied * lowFactor));
    const high = Math.max(s.implied, Math.round(s.implied * highFactor));
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.age,
      implied_value_usd: s.implied,
      value_low_usd: low,
      value_high_usd: high,
      issuance_probability: s.probability,
      issuance_cohort: s.cohort,
      expected_value_usd: Math.max(1, Math.round(s.implied * s.probability)),
      model: {
        category_multiple: Math.round(s.multiple * 1e4) / 1e4,
        category_comps: s.comps,
        growth_pct: s.growthPct,
        growth_multiplier: round4(s.growthMult),
        maturity_multiplier: round4(s.maturityMult),
        age_days: s.age,
      },
      farm_steps: farmSteps(s.p, s.age).map(stepText),
    };
  });
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** "$59", "$4.50": whole dollars bare, cents to two places. */
export function fmtMoney(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Cheap chains: low-fee L2s and low-fee L1s, where one transaction costs about $0.50–$1. */
const CHEAP_CHAINS = new Set([
  'Arbitrum', 'Optimism', 'Base', 'Polygon', 'zkSync Era', 'Linea', 'Scroll', 'Blast', 'Mode',
  'Unichain', 'Ink', 'Katana', 'Corn', 'Mantle', 'Metis', 'Gnosis', 'Avalanche', 'BSC', 'Binance',
  'Solana', 'Sui', 'Aptos', 'Near', 'Fantom', 'Celo', 'Kava', 'Sei', 'Starknet', 'Zora', 'Fraxtal',
]);

/**
 * What one transaction costs on a protocol's first chain, in whole dollars: Ethereum mainnet
 * is $5–$30 a transaction, cheap L2s and low-fee L1s about $0.50–$1, everything else about $2–$3.
 * The assumption is stated in the step text's verdict and in the README; the chain, not the
 * protocol's name, decides the tier.
 */
export function gasTier(p: SnapshotProtocol): { tier: string; fund: number; setup: number; weekly: number; claim: number } {
  const chain = chainOf(p);
  if (chain === 'Ethereum') return { tier: 'Ethereum mainnet', fund: 10, setup: 15, weekly: 6, claim: 10 };
  if (CHEAP_CHAINS.has(chain)) return { tier: 'cheap L2 / low-fee chain', fund: 0.5, setup: 1, weekly: 0.5, claim: 1 };
  return { tier: 'mid-fee chain', fund: 2, setup: 3, weekly: 2, claim: 3 };
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('synthetic')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the shares.`;
  if (c.includes('governance')) return `Lock $${capital} of the governance asset through ${name} on ${chain} and vote on one proposal.`;
  if (c.includes('payment') || c.includes('card')) return `Spend $${capital} through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${name}'s chain and use one of its apps.`;
  if (c.includes('cede')) return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
  if (c.includes('option')) return `Deposit $${capital} of USDC as collateral on ${name} and open one small option position.`;
  if (c.includes('launchpad')) return `Stake $${capital} through ${name} on ${chain} to qualify for its next allocation.`;
  if (c.includes('index')) return `Mint $${capital} of the ${name} index token on ${chain} and hold it.`;
  if (c.includes('privacy')) return `Deposit $${capital} of USDC into ${name}'s shielded pool on ${chain} and keep the receipt.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's weekly qualifying action, in the words a farmer can follow. */
function weeklyActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow a small amount against the supply on ${name}, then repay it the same week.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return `Swap a small amount through ${name}'s pool on ${chain} and add the fees to the position.`;
  if (c.includes('bridge')) return `Bridge a small amount back and forth through ${name} once a week.`;
  if (c.includes('staking') || c.includes('restak')) return `Claim the staking rewards on ${name} and restake them.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('synthetic') || c.includes('option')) return `Close and reopen the hedge on ${name} once a week so the position stays active.`;
  if (c.includes('prediction')) return `Settle one market and place one new position on ${name} each week.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('basis')) return `Top the ${name} vault up by $10 and rebalance the shares once a week.`;
  if (c.includes('stable')) return `Mint and redeem a small amount of the stable asset through ${name} each week.`;
  if (c.includes('rwa')) return `Claim the yield the ${name} asset paid and hold it in the same wallet.`;
  if (c.includes('governance')) return `Vote on one ${name} proposal a week, even a routine one.`;
  if (c.includes('insurance')) return `Renew or extend the cover on ${name} so the policy never lapses.`;
  if (c.includes('payment') || c.includes('card')) return `Make one small payment through ${name} each week and keep the receipt.`;
  if (c.includes('chain')) return `Use one app on ${name}'s chain each week from the same wallet.`;
  if (c.includes('launchpad')) return `Check ${name}'s allocation page weekly and join any open round.`;
  if (c.includes('index')) return `Rebalance the ${name} index position by $10 once a week.`;
  if (c.includes('privacy')) return `Move a small amount through ${name}'s shielded pool once a week.`;
  return `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. Gas follows the first chain: Ethereum mainnet $5–$30 a transaction, cheap L2s and
 * low-fee L1s about $0.50–$1, other chains about $2–$3. The last step totals the gas and the
 * active time into a cost per active hour and names the minimum capital — a cost rate, never
 * earnings, because no token is promised.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasTier(p);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyActionFor(p, capital, chain);
  const weeklyTotal = round2(gas.weekly * 4);
  const totalGas = round2(gas.fund + gas.setup + weeklyTotal + gas.claim);
  const ratePerHour = (totalGas * 60) / 80;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `${fmtMoney(gas.fund)} of gas to fund it on ${chain}`,
      time: '10 minutes',
    },
    {
      text: action,
      cost: `${fmtMoney(capital)} of capital and ${fmtMoney(gas.setup)} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weekly,
      cost: `${fmtMoney(gas.weekly)} of gas a week, ${fmtMoney(weeklyTotal)} over 4 weeks`,
      time: '10 minutes a week, 40 minutes over 4 weeks',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the ${fmtMoney(capital)} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: `${fmtMoney(gas.claim)} of gas to claim`,
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it. Total gas ${fmtMoney(totalGas)} over 80 active minutes is about $${ratePerHour.toFixed(2)} an hour of active work on ${gas.tier}, with ${fmtMoney(capital)} minimum capital locked for ${hold} days. That is a cost rate, not earnings: no token is promised.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** Every live-token protocol, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => p.mcap_usd !== null)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      symbol: p.symbol,
    }));
}

/**
 * The coverage accounting: every protocol in the snapshot is either a ranked row or one entry
 * here, with the reason. Ranked + live-token + token-on-record + excluded = the whole snapshot.
 */
export function buildCoverage(snapshot: Snapshot, board: BoardRow[]): Coverage {
  const ranked = new Set(board.map((r) => r.slug));
  const accounted: AccountedRow[] = [];
  let live = 0;
  let tokenOnRecord = 0;
  let excluded = 0;
  for (const p of snapshot.protocols) {
    if (ranked.has(p.slug)) continue;
    if (p.mcap_usd !== null) {
      live += 1;
      accounted.push({ slug: p.slug, name: p.name, reason: 'live-token', detail: `market cap ${fmtMoney(p.mcap_usd)} as recorded` });
    } else if (!isPreToken(p)) {
      tokenOnRecord += 1;
      const token = p.symbol !== null ? `symbol ${p.symbol}` : `CoinGecko id ${p.gecko_id ?? 'recorded'}`;
      accounted.push({ slug: p.slug, name: p.name, reason: 'token-on-record', detail: `records a token (${token}) but no market cap in the snapshot` });
    } else {
      excluded += 1;
      accounted.push({ slug: p.slug, name: p.name, reason: 'excluded', detail: exclusionReason(p) });
    }
  }
  accounted.sort((a, b) => (a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : a.slug < b.slug ? -1 : 1));
  return {
    total: snapshot.protocols.length,
    ranked: board.length,
    live_token: live,
    token_on_record: tokenOnRecord,
    excluded,
    accounted_for: board.length + accounted.length,
    accounted,
  };
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    value_low_usd: row.value_low_usd,
    value_high_usd: row.value_high_usd,
    issuance_probability: row.issuance_probability,
    issuance_cohort: row.issuance_cohort,
    expected_value_usd: row.expected_value_usd,
    multiple: row.model.category_multiple,
    multiple_n: row.model.category_comps,
    watchlist: watchlist.has(row.slug),
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData; validation: Validation } {
  const fit = fitModel(snapshot);
  const model = fit.model;
  const validation = validateModel(snapshot, model, fit);
  const board = buildBoard(snapshot, model, validation);
  const live = liveRows(snapshot);
  const coverage = buildCoverage(snapshot, board);
  const comps = categoryMultiples(snapshot.protocols, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const watchlist = new Set(snapshot.watchlist);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    overall_multiple: round4(comps.overall),
    multiples: Object.fromEntries(Object.entries(comps.multiples).map(([k, v]) => [k, round4(v)])),
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
    coverage,
    validation,
  };
  return { board, radar, validation };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  const values = new Set(board.map((r) => r.implied_value_usd));
  if (values.size !== board.length) return `${board.length - values.size} rows share an implied value with another row`;
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!Number.isSafeInteger(r.value_low_usd) || r.value_low_usd <= 0 || r.value_low_usd > r.implied_value_usd) return `${r.slug} has value range low ${r.value_low_usd}`;
    if (!Number.isSafeInteger(r.value_high_usd) || r.value_high_usd < r.implied_value_usd) return `${r.slug} has value range high ${r.value_high_usd}`;
    if (!(r.issuance_probability > 0 && r.issuance_probability < 1)) return `${r.slug} has issuance probability ${r.issuance_probability}`;
    if (!Number.isSafeInteger(r.expected_value_usd) || r.expected_value_usd <= 0) return `${r.slug} has expected value ${r.expected_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
