# Radar-7 model search results (make.fun token-radar-01)

Harness rebuilt 26 Nov 2026 from the radar-6 Methods note
(`~/workspace/makefun/radar7-model-search/exp.py` + `odds.py`) after the
radar-6 harness was wiped from /tmp. The harness now lives in the workspace,
not /tmp. Toolchain: Python numpy 1.26.4 / scipy 1.11.4.

Snapshot: the same sealed kit snapshot radar-4/5/6 used — 758 protocols,
fit set 128 tokenized with a usable market cap, `as_of` 2026-11-14. Market
median `change_7d` −9.31%; the momentum clamp binds on 0 rows.

## Validation directions (all in the harness)

- **LOO** — leave-one-out on the 128 fit rows (median absolute log error,
  × = exp(median)).
- **WF25** — fit on listed before 2025-01-01 (64), test on the 31 listed
  after.
- **WF24** — fit on listed before 2024-07-01 (52), test on the 43 listed
  after (includes the 31 WF25 rows — hit counts must NOT be added).
- **WF26** — NEW fourth direction: fit on listed before 2026-01-01 (86),
  test on the 9 listed after. Small (9 rows) — corroboration only.
- **5-fold** — stratified by TVL size; **category-blind** — hold out one
  category at a time (100 rows in categories with a hold-out).
- **Gate proxy** — hits within 2× on the 43 UNIQUE forward rows (31 WF25 +
  12 listed 2024-07-01..2024-12-31, each scored once).

KEEP rule (radar-6, strict): a spec ships only if it beats the pooled line
on LOO **and** both walk-forwards at once. Targets: WF ≤ ×2.7, LOO ≤ ×3.1.

## Sanity: the harness reproduces radar-6 exactly

| Spec | LOO | WF25 | WF24 | 5-fold | Cat-blind |
|---|---|---|---|---|---|
| pooled log-log | ×3.40 (41/128) | ×3.08 (8/31) | ×3.16 (14/43) | ×3.55 | ×3.49 |
| pooled + category ridge λ=64 | ×3.42 | ×2.99 | ×2.96 | — | — |

## E1 — market-relative momentum: FAIL

`mom_rel = change_7d − market median change_7d` (median −9.31%). The raw
growth coefficient was already insignificant with the wrong sign (OLS
−3.7139 ± 2.2993, t = −1.62). Centering does not rescue it:

| Spec | LOO | WF25 | WF24 | WF26 | 5-fold | Cat-blind | Gate |
|---|---|---|---|---|---|---|---|
| mom_rel OLS | ×3.76 | ×3.14 | ×2.88 | ×7.45 | ×3.75 | ×3.85 | 21/74 |
| mom_rel ridge λ=16 | ×3.41 | ×3.09 | ×3.15 | ×7.01 | ×3.57 | ×3.47 | 22/74 |
| mom_rel ridge λ=64 | ×3.40 | ×3.08 | ×3.16 | ×7.07 | ×3.55 | ×3.48 | 22/74 |
| mom_rel ridge λ=256 | ×3.40 | ×3.08 | ×3.16 | ×7.08 | ×3.55 | ×3.49 | 22/74 |

At λ=64/256 the LOO/WF25/WF24 numbers are identical to pooled to two
decimals (WF26 ×7.07–7.08 vs ×7.09, category-blind ×3.48–3.49 vs ×3.49) —
the term carries nothing. Unique forward hits: 10/43, same as pooled.

## E2 — kinship / category size: FAIL

`kin = log(1 + protocols in the same category)`.

| Spec | LOO | WF25 | WF24 | WF26 | 5-fold | Cat-blind | Gate |
|---|---|---|---|---|---|---|---|
| kin OLS | ×3.94 | ×2.75 | ×3.85 | ×5.61 | ×3.60 | ×3.24 | 22/74 |
| kin ridge λ=16 | ×3.79 | ×2.75 | ×3.76 | ×5.76 | ×3.62 | ×3.50 | 24/74 |
| kin ridge λ=64 | ×3.59 | ×3.08 | ×3.10 | ×6.83 | ×3.63 | ×3.55 | 22/74 |
| kin ridge λ=256 | ×3.55 | ×2.89 | ×3.12 | ×7.51 | ×3.62 | ×3.60 | 22/74 |

LOO loses badly at every level; its WF25 wins (OLS/λ=16 ×2.75 vs pooled
×3.08) come with a WF24 collapse (×3.85/×3.76 vs ×3.16) — no consistent
forward gain. Unique forward hits: 10/43.

## E3 — combinations: FAIL the strict KEEP

| Spec | LOO | WF25 | WF24 | WF26 | 5-fold | Cat-blind | Gate |
|---|---|---|---|---|---|---|---|
| mom_rel64 + kin64 | ×3.59 | ×3.07 | ×3.09 | ×6.83 | ×3.64 | ×3.55 | 22/74 |
| mom_rel16 + kin16 | ×3.74 | ×2.70 | ×3.72 | ×6.03 | ×3.67 | ×3.50 | 24/74 |
| mom_rel64 + catFE64 | ×3.43 | ×3.00 | ×2.96 | ×6.98 | ×3.60 | ×3.53 | 22/74 |
| mom_rel16 + catFE16 | ×3.56 | ×2.81 | ×3.11 | ×6.90 | ×3.68 | ×3.55 | 23/74 |
| mom_rel64 + kin64 + catFE64 | ×3.57 | ×3.22 | ×3.20 | ×6.80 | ×3.67 | ×3.60 | 24/74 |
| mom_rel64 + growth64 | ×3.40 | ×3.09 | ×3.16 | ×7.05 | ×3.56 | ×3.47 | 22/74 |

`mom_rel64 + catFE64` is a near-tie (LOO ×3.43, WF25 ×3.00, WF24 ×2.96,
gate 22/74 — same as pooled) but it does not beat pooled on LOO, so it
fails the strict rule and is not shipped. `mom_rel16 + kin16` wins WF25
(×2.70) but loses LOO (×3.74) and WF24 (×3.72) badly. Unique forward hits:
all 10/43 (mom_rel64 + catFE64: 10/43).

## E4 — shrink c=0.9 on pooled: THE PICK (near-tie under Miko's interval-high rule)

| Spec | LOO | WF25 | WF24 | WF26 | 5-fold | Cat-blind | Gate |
|---|---|---|---|---|---|---|---|
| **pooled, shrink c=0.9** | **×3.48 (42/128)** | **×2.86 (11/31)** | **×2.99 (16/43)** | **×6.40 (3/9)** | **×3.57** | **×3.55** | **27/74** |
| pooled log-log | ×3.40 (41/128) | ×3.08 (8/31) | ×3.16 (14/43) | ×7.09 (2/9) | ×3.55 | ×3.49 | 22/74 |
| catFE64 shrink c=0.9 | ×3.49 | ×2.79 | ×2.98 | ×6.56 | ×3.59 | ×3.57 | 26/74 |
| mom_rel64 shrink c=0.9 | ×3.49 | ×2.86 | ×2.98 | ×6.48 | ×3.57 | ×3.56 | 27/74 |
| mom_rel64+kin64 shrink c=0.9 | ×3.78 | ×2.69 | ×3.27 | ×6.98 | ×3.66 | ×3.87 | 27/74 |

- LOO is 2.0% WORSE than pooled (×3.48 vs ×3.40) — it fails the old
  strict KEEP. Bootstrap (5,000 reps): paired LOO median delta +0.0242 log
  units, 95% CI [−0.059, +0.104] — inside noise; paired wins 67/128.
- Forward: 15 unique hits vs pooled 10 (+5 in / 0 out: WF25 11 vs 8,
  WF24-disjoint 4 vs 2). Gate-proxy margin over the runner-up is ONE hit
  (15 vs 14 for pooled + TVL² and category ridge λ=64 + TVL²).
- Shrink variants on other specs give identical headline numbers (the extra
  terms carry nothing), so the simplest spec ships.
- The shrink is order-preserving, so board ranking by implied value is
  EXACTLY unchanged — only magnitudes compress (top Sentora $90.3M→$73.1M;
  board total $2,274M→$2,194M). One farm verdict flips SKIP→FARM (62→63).

**Why the pick follows Miko's rule (26 Nov 10:35 WIB):** among near-ties,
prefer the largest interval-high (rate + 1.6449×SE). The gate is judged on
interval high vs the money-place line 94.96%; at 12 matches the SE is
effectively fixed, so interval-high order is expected-rate order, and the
forward hit rate is the closest measurable analog of the expected rate on
future launches. The shrink is the only candidate that raises the forward
hit rate.

## Odds re-test: UNCHANGED

Momentum and kinship re-tested in the logistic (Python `odds.py` +
TypeScript `validateOdds`):

| Blend variant | Brier 10-fold | WF25 | WF24 |
|---|---|---|---|
| shipped blend | 0.2079 | 0.2236 | 0.2412 |
| blend + momentum | 0.2067 | 0.2231 | 0.2407 |
| blend + kinship | 0.2078 | 0.2252 | 0.2425 |

Gains ≤0.0012, within noise; the momentum logit alone is worse on WF25.
Rejected; the blend is unchanged.

## Verdict

- **E1 momentum: FAIL.** **E2 kinship: FAIL.** **E3 combos: FAIL** (strict
  KEEP; one near-tie, not shipped). **E4 shrink: SHIPS** as a near-tie pick
  under the interval-high rule — not a better fit, a bet on the gate.
- No spec meets the P1 targets (WF ≤ ×2.7, LOO ≤ ×3.1). Best LOO anywhere
  is ×3.37.
- Expected gate effect: +0.5–1.5pp of dev rate; the gate needs +1.7–2.0pp
  over radar-6 (90.33% → ≈92.0–92.4%). ~50/50 shot at the gate, not a
  guarantee. Top 10 (96.21%) remains structurally out of reach at 12
  matches (best 12-match entry ever 92.32%).
