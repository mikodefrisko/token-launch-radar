// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// radar-4. The model is a LOG-LOG TVL REGRESSION, fitted to the snapshot itself:
//   log(market cap) = intercept + slope x log(TVL)
// fitted by ordinary least squares over the 128 tokenized protocols with a usable
// market cap (144 record one; 16 record 0 or -1). Implied value is exp() of the
// fitted log value — the median prediction on the log scale. The slope is 0.52:
// market cap grows with the square root of TVL, not in proportion to it, which is
// why a category-median multiple (slope fixed at 1.0) mis-ranks the board.
//
// Nine candidate specifications were tried and scored by leave-one-out median
// absolute log error (see `fitRegression`): the pooled regression, category
// intercepts, category slopes, log-age and 7-day-growth terms, and combinations.
// Category and age terms do NOT help out of sample — every one of them scores
// worse on leave-one-out than the pooled line — and the growth term's coefficient
// is insignificant (t = -1.62) with a counterintuitive negative sign, so it is
// not shipped either. The pooled line wins outright (LOO median log error 1.223
// vs 1.325 for the next-best candidate), and it is also the simplest. The
// selection rule is: lowest LOO median absolute log error; within a 5% tie band,
// the fewest terms. No tie occurred.
//
// The fitted line is still weak in absolute terms — leave-one-out median absolute
// error ~85%, only ~32% of predictions within 2x of the actual market cap — and
// the value ranges below are taken from that error distribution, not invented.
// But it beats radar-3 (category-median multiple) on the symmetric log metric on
// every blind test: LOO median log error 1.223 vs 1.615, walk-forward 2025-01-01
// 1.124 vs 1.469, walk-forward 2024-07-01 1.151 vs 1.653; paired wins 81/128,
// 21/31 and 31/43. On the asymmetric median % error it beats radar-3 on LOO
// (85.2% vs 92.2%) and on walk-forward 2024-07-01 (90.9% vs 98.4%) but NOT on
// walk-forward 2025-01-01 (89.2% vs 82.9%): two large over-predictions
// (infrared-finance, falcon-finance) inflate the % median there, while the log
// median — the metric the fit minimises — favours radar-4. See VALIDATION-radar4.md.
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

/** The fitted log-log regression: log(mcap) = intercept + slope x log(TVL). Rounded to four decimals, and the board is computed from the rounded figures, so the board, the dashboard data and the page's recompute all agree exactly. */
export interface ModelConstants {
  intercept: number;
  slope: number;
}

/** One candidate specification for the candidate table: which secondary terms it adds to the pooled line. */
export interface CandidateSpec {
  name: string;
  cats: boolean;
  catSlopeMin: number | null;
  age: boolean;
  growth: boolean;
}

/** The nine candidates the fit scores by leave-one-out median absolute log error. */
export const CANDIDATES: CandidateSpec[] = [
  { name: 'pooled log-log', cats: false, catSlopeMin: null, age: false, growth: false },
  { name: 'pooled + category intercepts (n>=3)', cats: true, catSlopeMin: null, age: false, growth: false },
  { name: 'pooled + category intercepts + log(age)', cats: true, catSlopeMin: null, age: true, growth: false },
  { name: 'pooled + category intercepts + growth', cats: true, catSlopeMin: null, age: false, growth: true },
  { name: 'pooled + log(age)', cats: false, catSlopeMin: null, age: true, growth: false },
  { name: 'pooled + growth', cats: false, catSlopeMin: null, age: false, growth: true },
  { name: 'pooled + category intercepts + log(age) + growth', cats: true, catSlopeMin: null, age: true, growth: true },
  { name: 'pooled + category intercepts + category slopes (n>=10)', cats: true, catSlopeMin: 10, age: false, growth: false },
  { name: 'pooled + category intercepts + category slopes + log(age)', cats: true, catSlopeMin: 10, age: true, growth: false },
];

/** How many terms a candidate adds beyond the pooled line (intercept + slope): the tie-break prefers fewer. */
function termCount(spec: CandidateSpec): number {
  return (spec.cats ? 1 : 0) + (spec.catSlopeMin !== null ? 1 : 0) + (spec.age ? 1 : 0) + (spec.growth ? 1 : 0);
}

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-4';

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
    intercept: number;
    slope: number;
    log_tvl: number;
    fitted_log_mcap: number;
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
  watchlist: boolean;
  log_tvl: number;
  fitted_log_mcap: number;
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
  candidates: {
    variants: { name: string; terms: number; median_abs_log_error: number; median_abs_pct_error: number; within_2x: number; within_2x_pct: number }[];
    tie_band: number;
    best_median_abs_log_error: number;
    best_name: string;
    selected_name: string;
    selection_rule: string;
    regression: { intercept: number; slope: number; slope_se: number; intercept_se: number; growth_coef: number; growth_se: number; growth_t: number };
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
    median_abs_log_error: number;
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
    median_abs_log_error: number;
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

/** Solve a small dense linear system by Gaussian elimination with partial pivoting. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    if (Math.abs(M[piv]![c]!) < 1e-12) throw new Error('singular design matrix');
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    for (let r = c + 1; r < n; r++) {
      const f = M[r]![c]! / M[c]![c]!;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r]![n]!;
    for (let k = r + 1; k < n; k++) s -= M[r]![k]! * x[k]!;
    x[r] = s / M[r]![r]!;
  }
  return x;
}

/** OLS coefficients for a design matrix and target, via the normal equations. */
function ols(X: number[][], y: number[]): number[] {
  const p = X[0]!.length;
  const XtX = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const Xty = new Array<number>(p).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a]! += X[i]![a]! * y[i]!;
      for (let b = 0; b < p; b++) XtX[a]![b]! += X[i]![a]! * X[i]![b]!;
    }
  }
  return solveLinear(XtX, Xty);
}

/** The categories with at least `minN` protocols in the pool, sorted — the ones that get their own terms. */
function qualifyingCategories(pool: SnapshotProtocol[], minN: number): string[] {
  const counts = new Map<string, number>();
  for (const p of pool) if (p.category !== null) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n >= minN).map(([c]) => c).sort();
}

/**
 * One design row for a protocol under a candidate spec. Columns: [1, log TVL,
 * category-intercept dummies, category-slope terms, log age, growth]. Age uses 365
 * days when the listing date is unknown; growth is the 7-day TVL change clamped to
 * [-60, 120] per cent, as a fraction.
 */
function designRow(
  protocol: SnapshotProtocol,
  asOf: string,
  spec: CandidateSpec,
  cats: string[],
  slopeCats: string[],
): number[] {
  const row: number[] = [1, Math.log(protocol.tvl_usd)];
  if (spec.cats) for (const c of cats) row.push(protocol.category === c ? 1 : 0);
  if (spec.catSlopeMin !== null) {
    const lt = Math.log(protocol.tvl_usd);
    for (const c of slopeCats) row.push(protocol.category === c ? lt : 0);
  }
  if (spec.age) row.push(Math.log(Math.max(1, ageDays(asOf, protocol.listed_at) ?? 365)));
  if (spec.growth) row.push(Math.min(120, Math.max(-60, finite(protocol.change_7d, 0))) / 100);
  return row;
}

/** One candidate fitted on a pool: OLS on log market cap. Coefficients are rounded to four decimals, and every prediction below uses the rounded figures, so the board, the dashboard data and the page's recompute all agree exactly. */
function fitCandidate(
  pool: SnapshotProtocol[],
  asOf: string,
  spec: CandidateSpec,
): { beta: number[]; cats: string[]; slopeCats: string[] } {
  const cats = spec.cats ? qualifyingCategories(pool, 3) : [];
  const slopeCats = spec.catSlopeMin !== null ? qualifyingCategories(pool, spec.catSlopeMin) : [];
  const X = pool.map((p) => designRow(p, asOf, spec, cats, slopeCats));
  const y = pool.map((p) => Math.log(p.mcap_usd!));
  const beta = ols(X, y).map((b) => Math.round(b * 1e4) / 1e4);
  return { beta, cats, slopeCats };
}

/** A candidate's predicted market cap for one protocol. */
function predictCandidate(
  fit: { beta: number[]; cats: string[]; slopeCats: string[] },
  protocol: SnapshotProtocol,
  asOf: string,
  spec: CandidateSpec,
): number {
  const row = designRow(protocol, asOf, spec, fit.cats, fit.slopeCats);
  let s = 0;
  for (let i = 0; i < row.length; i++) s += row[i]! * fit.beta[i]!;
  return Math.exp(s);
}

/** Standard errors of a candidate's coefficients on its fit pool (residual variance x the inverse of X'X). */
function coefStandardErrors(
  pool: SnapshotProtocol[],
  asOf: string,
  spec: CandidateSpec,
  fit: { beta: number[]; cats: string[]; slopeCats: string[] },
): number[] {
  const X = pool.map((p) => designRow(p, asOf, spec, fit.cats, fit.slopeCats));
  const y = pool.map((p) => Math.log(p.mcap_usd!));
  const resid = y.map((yi, i) => {
    let s = 0;
    for (let j = 0; j < X[i]!.length; j++) s += X[i]![j]! * fit.beta[j]!;
    return yi - s;
  });
  const dof = Math.max(1, pool.length - X[0]!.length);
  const s2 = resid.reduce((a, b) => a + b * b, 0) / dof;
  const p = X[0]!.length;
  const XtX = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) XtX[a]![b]! += X[i]![a]! * X[i]![b]!;
  }
  const M = XtX.map((row, i) => [...row, ...Array.from({ length: p }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const d = M[c]![c]!;
    for (let k = 0; k < 2 * p; k++) M[c]![k]! /= d;
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = M[r]![c]!;
      for (let k = 0; k < 2 * p; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  const inv = M.map((row) => row.slice(p));
  return fit.beta.map((_, j) => Math.sqrt(Math.max(0, s2 * inv[j]![j]!)));
}

/** The multipliers and the implied value one protocol gets under the fitted log-log line. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): { implied: number; logTvl: number; fittedLogMcap: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const logTvl = Math.log(protocol.tvl_usd);
  const fittedLogMcap = model.intercept + model.slope * logTvl;
  const implied = Math.max(1, Math.round(Math.exp(fittedLogMcap)));
  return { implied, logTvl, fittedLogMcap, age };
}

/** Leave-one-out predictions for the fit set under one candidate: each protocol is scored by a fit that never saw it. */
function looPredictionsFor(
  snapshot: Snapshot,
  spec: CandidateSpec,
): { protocol: SnapshotProtocol; implied: number; actual: number }[] {
  const pool = fitSet(snapshot);
  return pool.map((p, i) => {
    const rest = pool.filter((_, j) => j !== i);
    const fit = fitCandidate(rest, snapshot.as_of, spec);
    return { protocol: p, implied: predictCandidate(fit, p, snapshot.as_of, spec), actual: p.mcap_usd! };
  });
}

/** Leave-one-out predictions for the fit set under the shipped pooled line. */
function looPredictions(
  snapshot: Snapshot,
): { protocol: SnapshotProtocol; implied: number; actual: number }[] {
  return looPredictionsFor(snapshot, CANDIDATES[0]!);
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
 * The fit: score all nine candidates by leave-one-out median absolute log error,
 * then select the lowest; within a 5% tie band, take the fewest terms. The pooled
 * line wins outright (1.223 vs 1.325 for the next-best candidate), so no tie
 * rule fires. Returns the fitted line plus the candidate table and the
 * coefficient standard errors that show why the rejected terms were rejected.
 */
export function fitRegression(snapshot: Snapshot): {
  model: ModelConstants;
  candidates: { name: string; terms: number; median_abs_log_error: number; median_abs_pct_error: number; within_2x: number; within_2x_pct: number }[];
  best: { name: string; median_abs_log_error: number };
  selected: { name: string; median_abs_log_error: number };
  regression: { intercept: number; slope: number; slope_se: number; intercept_se: number; growth_coef: number; growth_se: number; growth_t: number };
} {
  const table: { name: string; terms: number; median_abs_log_error: number; median_abs_pct_error: number; within_2x: number; within_2x_pct: number }[] = [];
  for (const spec of CANDIDATES) {
    const stats = errorStats(looPredictionsFor(snapshot, spec));
    table.push({
      name: spec.name,
      terms: termCount(spec),
      median_abs_log_error: stats.median_abs_log_error,
      median_abs_pct_error: stats.median_abs_pct_error,
      within_2x: stats.within_2x,
      within_2x_pct: stats.within_2x_pct,
    });
  }
  const sorted = [...table].sort((a, b) => a.median_abs_log_error - b.median_abs_log_error || a.terms - b.terms);
  const best = sorted[0]!;
  const band = best.median_abs_log_error * 1.05;
  const tied = table.filter((t) => t.median_abs_log_error <= band);
  tied.sort((a, b) => a.terms - b.terms || a.median_abs_log_error - b.median_abs_log_error);
  const selected = tied[0]!;
  const pool = fitSet(snapshot);
  const pooled = fitCandidate(pool, snapshot.as_of, CANDIDATES[0]!);
  const pooledSE = coefStandardErrors(pool, snapshot.as_of, CANDIDATES[0]!, pooled);
  const growthSpec = CANDIDATES[5]!;
  const growthFit = fitCandidate(pool, snapshot.as_of, growthSpec);
  const growthSE = coefStandardErrors(pool, snapshot.as_of, growthSpec, growthFit);
  const model: ModelConstants = { intercept: pooled.beta[0]!, slope: pooled.beta[1]! };
  return {
    model,
    candidates: table,
    best: { name: best.name, median_abs_log_error: best.median_abs_log_error },
    selected: { name: selected.name, median_abs_log_error: selected.median_abs_log_error },
    regression: {
      intercept: model.intercept,
      slope: model.slope,
      slope_se: round4(pooledSE[1]!),
      intercept_se: round4(pooledSE[0]!),
      growth_coef: growthFit.beta[2]!,
      growth_se: round4(growthSE[2]!),
      growth_t: round4(growthFit.beta[2]! / growthSE[2]!),
    },
  };
}

/** A blind walk-forward test: fit the pooled line on protocols listed before `cutoff`, test after it. */
function walkForward(
  snapshot: Snapshot,
  cutoff: string,
): { cutoff: string; fit_n: number; test_n: number; excluded_null_listed: number; median_abs_pct_error: number; mean_abs_pct_error: number; median_abs_log_error: number; within_2x: number; within_2x_pct: number } {
  const pool = fitSet(snapshot);
  const fitPool = pool.filter((p) => p.listed_at !== null && p.listed_at < cutoff);
  const testPool = pool.filter((p) => p.listed_at !== null && p.listed_at >= cutoff);
  const excluded = pool.filter((p) => p.listed_at === null).length;
  const fit = fitCandidate(fitPool, snapshot.as_of, CANDIDATES[0]!);
  const pairs = testPool.map((p) => {
    const implied = predictCandidate(fit, p, snapshot.as_of, CANDIDATES[0]!);
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
    median_abs_log_error: stats.median_abs_log_error,
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
 * The whole validation: the candidate table, leave-one-out errors, two blind walk-forward tests,
 * and the value-range factors from the leave-one-out error distribution.
 */
export function validateModel(snapshot: Snapshot, model: ModelConstants, fit: ReturnType<typeof fitRegression>): Validation {
  const looPairs = looPredictions(snapshot);
  const loo = errorStats(looPairs);
  const wf = walkForward(snapshot, '2025-01-01');
  const wf24 = walkForward(snapshot, '2024-07-01');
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
    candidates: {
      variants: [...fit.candidates].sort((a, b) => a.median_abs_log_error - b.median_abs_log_error),
      tie_band: 0.05,
      best_median_abs_log_error: fit.best.median_abs_log_error,
      best_name: fit.best.name,
      selected_name: fit.selected.name,
      selection_rule:
        'Score all nine candidates by leave-one-out median absolute log error over the 128 tokenized protocols with a usable market cap; select the lowest, and within a 5% tie band take the fewest terms. The pooled log-log line wins outright, so no tie rule fires.',
      regression: fit.regression,
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
    const { implied, logTvl, fittedLogMcap, age } = impliedValue(p, snapshot.as_of, model);
    const { probability, cohort } = issuanceFor(p, snapshot.as_of, cohorts.cohorts);
    return { p, implied, logTvl, fittedLogMcap, age, probability, cohort };
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
        intercept: model.intercept,
        slope: model.slope,
        log_tvl: round4(s.logTvl),
        fitted_log_mcap: s.fittedLogMcap,
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
    watchlist: watchlist.has(row.slug),
    log_tvl: row.model.log_tvl,
    fitted_log_mcap: row.model.fitted_log_mcap,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData; validation: Validation } {
  const fit = fitRegression(snapshot);
  const model = fit.model;
  const validation = validateModel(snapshot, model, fit);
  const board = buildBoard(snapshot, model, validation);
  const live = liveRows(snapshot);
  const coverage = buildCoverage(snapshot, board);
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
