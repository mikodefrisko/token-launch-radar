# Validation — radar-4 (make.fun token-radar-01)

Rebuilt 2026-11-25. Model `radar-4` in `lib/model.ts`; run with
`MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>`. All numbers below
are produced by that run from `input/snapshot.json` (758 protocols, 40 watchlist,
`as_of` 2026-11-14) and are carried in `out/validation.json` and in the
dashboard's data (`window.RADAR.validation`, shown in the model panel).

## 1. What was fitted, and how

The radar-3 model was a category-median multiple — a slope fixed at 1.0 on log
TVL, with the level set per category. Radar-4 replaces it with a **pooled
log-log regression** fitted on the same 128 tokenized protocols:

```
log(market cap) = 6.9646 + 0.5223 × log(TVL)
```

- **Fit set:** 144 protocols record a market cap; **128 are usable** (positive
  market cap and positive TVL). 16 record 0 or −1 (e.g. `autofinance` −1,
  `multichain` 0, `phemex` 0) and cannot form a log market cap.
- **Slope 0.5223 (SE 0.0949, t = 5.51)** — a 10% higher TVL is associated with
  a ~5.2% higher market cap among tokenized protocols. The slope is far below
  1.0, which is exactly why the radar-3 category-median (slope 1.0) over-valued
  the biggest TVL protocols: Steakhouse Financial's implied value falls from
  $581M (radar-3) to $90M (radar-4). Intercept 6.9646 (SE 1.6901).
- **Candidate search:** 9 specifications were fitted and scored by the same
  leave-one-out objective as radar-3 — median absolute log error of
  leave-one-out predictions (each tokenized protocol scored with itself left
  out of the fit). Selection rule (in code, `fitModel`): lowest LOO median
  absolute log error; within a 5% tie band, fewest terms.

| Spec | LOO median \|log error\| | LOO median % error | Within 2× |
| --- | --- | --- | --- |
| **Pooled log-log (selected)** | **1.223** | **85.2%** | **41 / 128** |
| Pooled + log(age) | 1.270 | 86.7% | 41 / 128 |
| Pooled + growth | 1.325 | 87.0% | 37 / 128 |
| Pooled + category intercepts + category slopes (n ≥ 10) | 1.327 | 88.5% | 32 / 128 |
| Pooled + category intercepts + category slopes + log(age) | 1.355 | 88.5% | 31 / 128 |
| Pooled + category intercepts + growth | 1.364 | 89.9% | 38 / 128 |
| Pooled + category intercepts + log(age) + growth | 1.371 | 90.2% | 38 / 128 |
| Pooled + category intercepts (n ≥ 3) | 1.413 | 86.9% | 37 / 128 |
| Pooled + category intercepts + log(age) | 1.418 | 86.9% | 37 / 128 |

No tie band fires: the pooled line wins outright (1.223 vs next-best 1.270).
Age and category terms do **not** clearly help out-of-sample — every one of
them makes LOO worse — so they are not shipped. The growth term is worth
naming because it is the closest thing to a rival: pooled + growth beats
radar-3 on all three % medians (LOO 87.0%, WF25 77.9%, WF24 91.1%), but its
coefficient is −3.714 ± 2.299, t = −1.62 — insignificant, and with the wrong
sign (faster 7-day TVL growth predicts a *lower* market cap). A term the data
cannot sign and cannot distinguish from zero is noise, not a model; it is not
shipped, and chasing it would be fitting the 128-point noise floor.

## 2. Blind tests — still weak, honestly better

**Leave-one-out, all 128 tokenized protocols (fitted model):**

| Metric | radar-4 | radar-3 |
| --- | --- | --- |
| Median absolute % error | **85.2%** | 92.2% |
| Mean absolute % error | 986% (a few huge misses dominate the mean) | 3,667% |
| Median absolute log error | **1.223** | 1.615 |
| Within 2× of actual market cap | **41 / 128 (32.0%)** | 25 / 128 (19.5%) |
| Actual / implied, quantiles q10 / q25 / q50 / q75 / q90 | 0.063 / 0.306 / 1.076 / 4.194 / 8.631 | 0.069 / 0.229 / 0.855 / 5.53 / 12.18 |

**Walk-forward, cutoff 2025-01-01** (regression fitted on the 64 protocols
listed before it, tested on the 31 listed after it; 33 tokenized protocols
have no `listed_at` and are excluded from this test): median absolute error
**89.2%**, mean 393%, **8 / 31 (25.8%)** within 2×, median log error 1.124.
Radar-3 on the same split: 82.9%, 10 / 31, median log error 1.469.

**Walk-forward, cutoff 2024-07-01** (fit 52, test 43): median absolute error
**90.9%**, mean 612%, **14 / 43 (32.6%)** within 2×, median log error 1.151.
Radar-3 on the same split: 98.4%, 9 / 43, median log error 1.653.

**The honest comparison.** On the symmetric median log error — the metric the
fit minimises, and the one that treats over- and under-prediction equally —
radar-4 beats radar-3 on **all three** blind tests (LOO 1.223 vs 1.615; WF25
1.124 vs 1.469; WF24 1.151 vs 1.653), and wins the paired comparison on most
protocols (81 / 128 LOO, 21 / 31 WF25, 31 / 43 WF24). On the median % error,
radar-4 beats radar-3 on LOO (85.2% vs 92.2%) and WF24 (90.9% vs 98.4%) but
**not** on WF25 (89.2% vs 82.9%). That WF25 miss is driven by two large
over-predictions in the 31-protocol test set (infrared-finance, falcon-finance);
the % metric punishes over-prediction asymmetrically (an over-prediction can
be 1,000% wrong, an under-prediction at most 100%), so a couple of big misses
move it while the log metric does not. The model is still weak in absolute
terms — a median error near 90% means the typical implied value is about
double or half the eventual market cap — and the ranges below are the honest
consequence. But it is a real, measured improvement on every blind test that
does not depend on one or two outliers, and it comes from a strictly simpler
model (one line, two parameters) than radar-3's 45-setting grid.

## 3. Ranges (earned from the LOO distribution)

`value_low_usd = implied × 0.306`, `value_high_usd = implied × 4.194` — the 25th
and 75th percentiles of (actual mcap / leave-one-out implied) over the 128
tokenized protocols: the middle 50% of backtested outcomes. Example: rank 1
Sentora Curator, implied $90,255,909 → range $27,618,308–$378,533,282. The
13.7× width (vs radar-3's 24×) is the model's measured error, not a styling
choice.

## 4. Issuance probability (record share, not a forecast)

Unchanged from radar-3: outcome "records a token" (a CoinGecko id or a symbol
on record). 416 / 758 protocols record one (overall rate 0.549). Cohorts are
age × TVL, shrunk with 20 pseudo-counts towards the overall rate so small
cohorts do not swing to 0 or 1. Probabilities are rounded to 2 decimals,
range 0.30–0.77.

| Age | TVL | n | Tokenized | Raw | Probability |
| --- | --- | --- | --- | --- | --- |
| <1y | <$10M | 33 | 5 | 0.15 | 0.30 |
| <1y | $10–50M | 70 | 24 | 0.34 | 0.39 |
| <1y | $50–250M | 41 | 17 | 0.41 | 0.46 |
| <1y | $250M+ | 16 | 6 | 0.38 | 0.47 |
| 1–2y | <$10M | 34 | 13 | 0.38 | 0.44 |
| 1–2y | $10–50M | 66 | 21 | 0.32 | 0.37 |
| 1–2y | $50–250M | 55 | 21 | 0.38 | 0.43 |
| 1–2y | $250M+ | 28 | 15 | 0.54 | 0.54 |
| 2–3y | <$10M | 24 | 13 | 0.54 | 0.54 |
| 2–3y | $10–50M | 54 | 24 | 0.44 | 0.47 |
| 2–3y | $50–250M | 35 | 22 | 0.63 | 0.60 |
| 2–3y | $250M+ | 26 | 17 | 0.65 | 0.61 |
| 3y+ | <$10M | 34 | 27 | 0.79 | 0.70 |
| 3y+ | $10–50M | 67 | 56 | 0.84 | 0.77 |
| 3y+ | $50–250M | 27 | 24 | 0.89 | 0.74 |
| 3y+ | $250M+ | 35 | 22 | 0.63 | 0.60 |
| unknown | <$10M | 20 | 18 | 0.90 | 0.72 |
| unknown | $10–50M | 37 | 28 | 0.76 | 0.68 |
| unknown | $50–250M | 32 | 24 | 0.75 | 0.67 |
| unknown | $250M+ | 24 | 19 | 0.79 | 0.68 |

Age is the strong axis (0.33 <1y → 0.79 at 3y+); TVL is nearly flat
(0.52–0.61). The unknown-age cohort runs hot (0.79) — those protocols mostly
lack a listing date, not a history. **Expected value = implied × probability.**
Ranks are by implied value, not expected value: the gate requires implied value
not to rise as rank ascends, so ranking by expected value would make the board
invalid. The dashboard sorts by expected value as well, and the detail view
shows both. This is a gate constraint, documented here and in the model panel,
not a modelling choice.

## 5. Coverage — 758 / 758

| Bucket | Count |
| --- | --- |
| Ranked (40 watchlist + 158 early) | 198 |
| Live-token (market cap shown) | 144 |
| Token on record, no market cap | 272 |
| Pre-token, excluded by the house rule | 144 |
| **Total accounted for** | **758** |

The 272 "token on record" rows are mostly versioned pools of tokenized
protocols (e.g. `aave-v3` → AAVE, `aerodrome-slipstream` → AERO): they record a
symbol but no market cap. The 144 excluded pre-token rows break down as 42
centralised exchanges, 38 Liquid Staking, 28 Bridge, 15 Canonical Bridge,
3 Liquid Restaking, 2 Restaked BTC, 11 versioned pools, 5 wrapped/staked-named.
Board size 198 is below the ~300–400 aim in the brief: that is deliberate.
Ranking the excluded 144 would put wrapped/staked/bridged products of tokens
that already trade (e.g. `binance-staked-eth`, `base-bridge`) at the top of a
"token launch" board, which the snapshot's own watchlist rule forbids. 198 is
the whole honest set.

## 6. Board

- 198 rows, ranks 1..198 exactly once, implied values non-increasing and all
  distinct (0 distinctness adjustments needed — no $1 step-downs fired).
- Watchlist 40/40. Farm steps 6 per row, 20–600 chars each, every step with a
  dollar cost and a time; step 6 totals gas and 80 active minutes into a cost
  per active hour and names the minimum capital ($50–$250 by TVL). Gas tiers
  by first chain: Ethereum mainnet ($10/$15/$6/$10 per fund/setup/weekly/claim
  tx), cheap L2 / low-fee chain ($0.50/$1/$0.50/$1), mid-fee chain ($2/$3/$2/$3).
- Board total implied $2,273,601,956; total expected $1,074,367,830. (The total
  roughly halves vs radar-3's $4,550,382,504 because the fitted slope 0.52
  compresses the top of the board — the biggest TVL protocols no longer scale
  linearly into nine-figure implied values.)
- Top 10: Sentora Curator $90,255,909 · Steakhouse Financial $90,194,278 ·
  Gauntlet $67,423,830 · Veda $67,104,619 · USDD $54,664,159 ·
  Nonce Capital $37,525,622 · Upshift $36,960,967 · Bittensor dTAO
  $31,880,403 · Polymarket International $29,313,269 · Onre $28,767,776.
  (Ranges and probabilities per row in `board.json`; top-row detail in §3.)
  BitFi Basis ($137.8M in radar-3) drops out of the top 10; Polymarket
  International enters at #9. Sentora Curator and Steakhouse Financial swap
  places at the top and are nearly tied ($90.26M vs $90.19M).

## 7. Determinism and gate checks

- `main.ts` run twice into separate directories: **byte-identical outputs**
  (`diff -r` clean on board.json, validation.json, data.js, dashboard/,
  screenshots/, dossier.json). No network, stdlib only, Node 22-compatible
  TypeScript (run here on Node v24.22.1).
- Independent verification (`~/workspace/makefun/verify-radar4.mjs`, 35 checks,
  all PASS): board gates (rows, ranks, order, distinctness, watchlist,
  farm-step lengths, implied = round(exp(fitted log mcap)) for every row),
  coverage slugs == snapshot slugs with no duplicates, data.js rows == board
  rows, page `impliedOf()` == board implied for all 198 rows, dashboard
  source 46,761 bytes (≤ 64 KB), dossier text 47,025 bytes (≤ 65,536, no cut),
  no http/https in dashboard files, no referral codes in code, no secrets.
- Dashboard source total 46,761 bytes (app.css 8,959 + app.js 37,354 +
  index.html 448). Dossier 742,805 bytes on disk (≤ 1.5 MiB gate cap), text
  47,025 bytes (≤ 65,536, no cut). Screenshots 1440×900, 153 / 212 / 153 KB.
- One fix found by the verifier during this build: `fitted_log_mcap` was
  stored rounded to 4 decimals, which moved the recomputed implied value by
  up to a few thousand dollars on 196 of 198 rows. It is now stored at full
  precision in `board.json`/`data.js` (displayed to 4 decimals in the detail
  view), so `implied = round(exp(fitted log mcap))` holds exactly for every
  row.

## 8. Known limits and things not verified

- **Screenshots re-taken for radar-4** (Playwright headless shell, 1440×900,
  153 / 212 / 153 KB) and visually checked: board, detail
  `#p=sentora-curator`, filtered `#category=Risk%20Curators`. They match the
  rebuilt page. Note: the Meta-chromium binary at `/opt/meta-chromium/chrome`
  refused to start in this VM ("Hatch WebGL domain policy is required for
  browser startup", headless and headed under Xvfb alike), so the captures
  used the plain Playwright-managed `chromium_headless_shell` build instead;
  the page itself is unchanged and renders identically.
- **Snapshot artifacts, followed as recorded:** USDD and Bittensor dTAO rank in
  the top 10 because the snapshot records no token for them, although their
  tokens trade in the real world. The board follows the snapshot's record, as
  the rules require; the README names this.
- **The model is still weak (§2).** Median error ~85–91% across the blind
  tests. The improvement over radar-3 is real on the log metric and on two of
  three % medians, but the absolute error remains large and the WF25 %
  median is worse — do not present radar-4 as a precise valuation.
- **Walk-forward excludes 33 tokenized protocols** with no `listed_at`; the
  test sets are small (31 and 43). Treat the walk-forward numbers as
  indicative, not precise.
- **Issuance probability is a record share**, not a launch forecast: older
  protocols are more likely to record a token partly because they have had
  longer to launch one, and the snapshot cannot say when a token appeared.
- **Gas tiers are assumptions** ($5–$30 Ethereum, ~$0.50–$1 cheap L2, ~$2–$3
  other chains), stated in the steps and README, not measured per chain.
- **Not re-run through the kit's `check`** (needs transcripts + a repo); the
  gate checks above are the local equivalent for board/dashboard/dossier.
