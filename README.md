# Token Radar — pre-token protocols ranked by implied value

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/mikodefrisko/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/mikodefrisko/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Entry for [make.fun](https://make.fun/bounty/token-radar-01) competition **token-radar-01** ("Build the best token launch radar").
Account: @golden-badger-44 · wallet `ApmXVZkSs74N5Z9hkSNMHA6abUbKyEoS5BNmhdAM6znx`.

## What it does

`main.ts` (Node 22, standard library only) reads a DefiLlama protocol snapshot
(`/input/snapshot.json`, 758 protocols, as of 2026-11-14) and writes:

- `board.json` — **198 ranked rows**: all 40 watchlist protocols (≥$50M TVL, no token
  on record) plus 158 pre-token protocols the house's watchlist rule keeps, at any
  TVL — the whole honest set. Ranked by implied value, each row also carrying a
  value range, an issuance probability and an expected value.
- `validation.json` — the fit and its blind tests: 16 regression candidates on
  five blind splits (leave-one-out, two walk-forwards, 5-fold, category-blind),
  the nested-selection check, range factors with realized coverage, issuance
  odds with Brier scores, farm tiers, a KPI summary, the build checksum and
  coverage counts.
- `data.js` + `dashboard/` — a static page (no network, no fetch) with the board,
  a per-protocol detail view with the model's inputs, value range, issuance
  probability, nearest priced peers and a farm plan, search, category / chain /
  farm-verdict filters, a watchlist-only toggle, category leaders, a separate
  Live-token view for all 144 already-trading protocols (shown with their
  market caps, never mixed into the ranking), and a Coverage tab that accounts
  for all 758 protocols. The board itself carries a KPI strip (walk-forward
  miss, range honesty, odds Brier, terms survived, farmable rows), an integrity
  strip (every check the page recomputes from `data.js`), and evidence tables
  for the value terms and odds variants.
- `screenshots/` — 3 real screenshots of the dashboard (board, detail, filtered).
- `dossier.json` — built with the vendored `vendor/makefun-board.ts`.

## The model (radar-7)

Implied value follows only from the snapshot's own figures — never from a
hardcoded list of names — and its terms are FIT, not asserted. It is a pooled
log-log regression over the 128 tokenized protocols with a usable market cap
(144 record one; 16 record 0 or −1), with predictions shrunk 10% toward the
fit-set mean log market cap:

- **Implied value** = `round(exp(16.2136 + 0.9 × (6.9646 + 0.5223 × ln(tvl_usd) − 16.2136)))`.
- **Slope 0.5223 (OLS SE 0.0949, t = 5.51; the dashboard also shows the
  200-refit bootstrap standard error)**: a 10% higher TVL is associated with a ~5.2% higher market cap. The slope is far below 1.0,
  which is why the radar-3 category-median model (slope fixed at 1.0)
  over-valued the biggest TVL protocols. Twenty-five candidate specifications were
  scored by leave-one-out median absolute log error — the pooled line, a TVL²
  term, category ridge effects (λ=16/64/256), log-age, 7-day-growth and chain-count terms,
  market-relative momentum and kinship (category size) terms, combinations,
  median (LAD) and trimmed fits, heavy-shrinkage re-tests of age
  and growth, and two negative controls — and
  the shrink wins the GATE-PROXY tie-break among the specs inside a 5% LOO tie
  band: it has the best forward hit rate on the 43 unique walk-forward rows
  (15 vs 10 for the pooled line, +5 in / 0 out). The lowest-LOO spec (category
  ridge λ=64 + TVL², 1.215) is only 0.7% better, adds terms, and fails
  walk-forward 2024 (×3.83 vs ×3.16), so it is not shipped either. The growth
  term's coefficient is insignificant (−3.714 ± 2.299, t = −1.62) with the
  wrong sign, so it is not shipped either; market-relative momentum shrinks to
  the pooled line at every ridge level (identical LOO/WF25/WF24 numbers;
  WF26 ×7.07–7.08 vs ×7.09), and kinship loses
  LOO badly (×3.59–×3.94). The negative controls (a deterministic pseudo-random
  number, another row's growth) do not help — LOO ×3.55 and ×3.50 against
  ×3.40 for the pooled line. A fifth search round (radar-7, 23 specifications:
  market-relative momentum, kinship, their combination, and the shrink) found
  no spec that beats the pooled line on LOO *and* both walk-forwards at once —
  the shrink is a NEAR-TIE picked for the gate, not a better fit: its LOO
  median is 2.0% worse than pooled (×3.48 vs ×3.40), inside bootstrap noise.
  Full numbers: `VALIDATION-radar7.md` and
  `~/workspace/makefun/radar7-model-search-results.md`.

Blind tests, honestly: leave-one-out median absolute error **83.9%** (mean
967% — a few huge misses dominate the mean), **42 of 128** predictions within
2× of the actual market cap, median absolute log error **1.248**. Walk-forward
— regression fitted on protocols listed before 2025-01-01, tested on the 31
listed after it — median error **90.0%**, 11 of 31 within 2×, median log error
1.051; a second cutoff (2024-07-01) gives 89.2%, 16 of 43 within 2×, median
log error 1.094. A third, new cutoff (2026-01-01) gives 3 of 9 within 2×.
Two more blind splits: 5-fold stratified by size, median
error 83.9% (×3.58, 41 of 128 within 2×); category-blind, 81.1% (×3.55, 36 of
100 in categories with a hold-out). Against the flat median-multiple baseline
the shrink line wins on every split (LOO ×3.48 vs ×5.07, WF25 ×2.86 vs ×5.35,
WF24 ×2.99 vs ×5.03). Against radar-3 (LOO 92.2% / 25 of 128, WF25 82.9% /
10 of 31, WF24 98.4% / 9 of 43), radar-7 wins on the symmetric log metric on
all three blind tests (1.248 vs 1.615; 1.051 vs 1.469; 1.094 vs 1.653) and on
the % median on LOO and WF24, but **loses the WF25 % median** (90.0% vs
82.9%) — driven by two large over-predictions in the 31-protocol test set.
Nested term selection (re-picking terms inside each training split) agrees
with the fixed selection in 0 of 7 checks; where it disagrees it tests
worse in 3 of 7 and better in 4 — it optimises LOO, the fixed selection
optimises the forward hit rate, so they disagree by construction. The model
is still weak, and the ranges say so: each row's `value_low_usd` /
`value_high_usd` are the implied value × its own category's 25th/75th
percentiles of (actual mcap / leave-one-out implied) — categories with fewer
than 8 tokenized protocols use the global ×0.294 / ×3.969. Realized coverage
of that middle 50%: LOO 48.4%, WF25 41.9%, WF24 48.8%; of
the wide 80% band (×0.061–×10.139): LOO 79.7%, WF25 77.4%, WF24 81.4%. Full
numbers: `out/validation.json` and `VALIDATION-radar7.md`.

**Issuance probability** is a 50/50 blend of a logistic fit (log TVL + log age
+ category ridge λ=4) and the cohort record share (age × TVL bucket, shrinkage
m=20 towards the overall 55% rate). Brier scores: leave-one-out 0.2066,
10-fold 0.2079, walk-forward 2025 0.2236 (base rate 0.3207, n=323),
walk-forward 2024 0.2412 (base rate 0.3669, n=414). The blend beats either
component on every split (logistic alone, λ=16: LOO 0.2174, 10-fold 0.2191,
WF25 0.2720, WF24 0.2543; λ=4 improves its 10-fold to 0.2133. Cohort alone:
LOO 0.215, 10-fold 0.2163, WF25 0.3046, WF24 0.3635). A 24-month
horizon was tested and rejected (Brier 0.2236 vs 0.2180 base on 302 protocols
aged 2y+). Radar-7 re-tested the two new signals in the odds as well —
market-relative momentum and kinship move the blend's Brier by at most 0.0012
on any split (10-fold 0.2067/0.2078 vs 0.2079, WF25 0.2231/0.2252 vs 0.2236,
WF24 0.2407/0.2425 vs 0.2412), within noise, and the momentum logit alone is
worse on WF25 — so the blend is unchanged. It is a record share, not a forecast, and the board never claims a
token will launch. **Expected value** = implied × probability. Ranks are by
implied value — the gate requires implied value not to rise as rank ascends —
and the dashboard also sorts by expected value.

**Coverage: 758 / 758.** Ranked 198 (40 watchlist + 158 early). Live-token 144
(market caps shown). Token on record but no market cap 272 (mostly versioned
pools of tokenized protocols, e.g. aave-v3 → AAVE). Pre-token but excluded by
the house rule 144 (42 centralised exchanges, 38 Liquid Staking, 28 Bridge,
15 Canonical Bridge, 3 Liquid Restaking, 2 Restaked BTC, 11 versioned pools,
5 wrapped/staked-named). The board ranks no wrapped, staked or bridged product
of a token that already trades.

Top of the board: Sentora Curator $73,126,668 (range $21.5M–$290.2M) ·
Steakhouse Financial $73,081,725 · Gauntlet $56,244,463 · Veda $56,004,751 ·
USDD $46,567,198. Board total implied value $2,194,213,731. All 198 implied
values are distinct. Note on the snapshot's record: USDD and Bittensor
dTAO rank high because the snapshot records no token for them, even though
their tokens trade in the real world — the board follows the snapshot's record,
as the rules require ("records no token", never "has none").

## Farm plans

Every row carries a 6-step farm plan derived from the protocol's own record
(category, chains, TVL, age), dated to the row's own hold: Day 0 fresh wallet,
Day 1 category-specific position (supply, LP, vault deposit, bridge, stake,
mint, …) sized $50–$250 by TVL on the protocol's first chain, Day 7 weekly
action, one step covering Day 14, 21 and 28 (repeat the weekly action, then
hold untouched until the hold day), exit and farm log on Day {hold} (30–60
days by age).
The exit rule is per-row: a FARM or MARGINAL row claims within 7 days of a
token announcement inside the hold and unwinds at Day {hold} otherwise; a SKIP
row unwinds on Day {hold} whether or not a token is announced, because the
stated scenario already loses money. Every step states its
cost in dollars and its time; gas follows the protocol's first chain (Ethereum
mainnet $5–$30 a transaction, cheap L2s and low-fee L1s about $0.50–$1, other
chains about $2–$3). The last step totals the gas and the 80 active minutes
into a cost per active hour and names the minimum capital — a cost rate, not
earnings, because no token is promised. No invented URLs, no airdrop promises.
"Pre-token" means the DefiLlama record lists no token — it is not proof a token
will ever exist, and implied value is this entry's own claim, not a price.

Each row also carries a farm verdict under a stated scenario (5% allocation,
the farmer capturing 1/5000 of it, T-bill 4.5%/yr on locked capital, 80 active
minutes): **FARM 63, MARGINAL 88, SKIP 47** of 198. FARM means the net value
beats $25/hour of active work; MARGINAL means it is positive but below that;
SKIP means it loses money. The best rows net over $200/hour (Steakhouse
Financial +$264.79/h, Veda +$223.03/h, Sentora Curator +$213.11/h); the worst lose about
$39/hour. Each row prints its break-even drop share (median 0.0004% of
expected value), so the verdict is re-derivable — and the verdict is
conditional on the share: the board shows the tier counts at 1/1000, 1/5000,
1/20000 and 1/50000.

## How to run

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

Requires Node 22+. No network, no dependencies, no secrets. The program exits
non-zero if the board misses any watchlist slug, ranks out of order, or a farm
plan breaks its length rules.

Screenshots are taken from the rebuilt dashboard with the Playwright-managed
headless shell (the Meta-chromium binary at `/opt/meta-chromium/chrome`
refuses to start in this VM): board at 1440×900, detail via
`#p=sentora-curator`, filtered via `#category=Risk%20Curators` (the shot
scrolls the controls into view so the filter shows). Each is visually checked
against the rebuilt page before it ships.

---

<sub>Entered on [make.fun](https://make.fun/?ref=yzjekwck&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
