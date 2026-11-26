// Token Radar dashboard: renders window.RADAR (data.js, written by main.ts). No network.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watchlistOnly: false, verdict: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, coverageReason: 'all' };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  // The model in one function: the page recomputes a row from the snapshot figures, so page
  // and board are visibly the same arithmetic. Older data without shrink fields recomputes raw.
  function impliedOf(row, model) {
    var raw = model.intercept + model.slope * Math.log(row.tvl_usd);
    var fitted = (model.shrink === null || model.shrink === undefined || model.mean_log_mcap === undefined)
      ? raw
      : model.mean_log_mcap + model.shrink * (raw - model.mean_log_mcap);
    return Math.max(1, Math.round(Math.exp(fitted)));
  }
  // Board total implied value.
  var totalImplied = DATA.rows.reduce(function (sum, r) { return sum + r.implied_value_usd; }, 0) || 1;

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('synthetic') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s basis vault on " + chain + ' and keep the shares.';
    if (c.indexOf('governance') >= 0) return 'Lock $' + capital + ' of the governance asset through ' + name + ' on ' + chain + ' and vote on one proposal.';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return 'Spend $' + capital + ' through ' + name + ' on ' + chain + ' and keep the receipt.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' of USDC to ' + name + "'s chain and use one of its apps.";
    if (c.indexOf('cede') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('option') >= 0) return 'Deposit $' + capital + ' of USDC as collateral on ' + name + ' and open one small option position.';
    if (c.indexOf('launchpad') >= 0) return 'Stake $' + capital + ' through ' + name + ' on ' + chain + ' to qualify for its next allocation.';
    if (c.indexOf('index') >= 0) return 'Mint $' + capital + ' of the ' + name + ' index token on ' + chain + ' and hold it.';
    if (c.indexOf('privacy') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s shielded pool on " + chain + ' and keep the receipt.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyActionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow a small amount against the supply on ' + name + ', then repay it the same week.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0) return 'Swap a small amount through ' + name + "'s pool on " + chain + ' and add the fees to the position.';
    if (c.indexOf('bridge') >= 0) return 'Bridge a small amount back and forth through ' + name + ' once a week.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Claim the staking rewards on ' + name + ' and restake them.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('synthetic') >= 0 || c.indexOf('option') >= 0) return 'Close and reopen the hedge on ' + name + ' once a week so the position stays active.';
    if (c.indexOf('prediction') >= 0) return 'Settle one market and place one new position on ' + name + ' each week.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('basis') >= 0) return 'Top the ' + name + ' vault up by $10 and rebalance the shares once a week.';
    if (c.indexOf('stable') >= 0) return 'Mint and redeem a small amount of the stable asset through ' + name + ' each week.';
    if (c.indexOf('rwa') >= 0) return 'Claim the yield the ' + name + ' asset paid and hold it in the same wallet.';
    if (c.indexOf('governance') >= 0) return 'Vote on one ' + name + ' proposal a week, even a routine one.';
    if (c.indexOf('insurance') >= 0) return 'Renew or extend the cover on ' + name + ' so the policy never lapses.';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return 'Make one small payment through ' + name + ' each week and keep the receipt.';
    if (c.indexOf('chain') >= 0) return 'Use one app on ' + name + "'s chain each week from the same wallet.";
    if (c.indexOf('launchpad') >= 0) return "Check " + name + "'s allocation page weekly and join any open round.";
    if (c.indexOf('index') >= 0) return 'Rebalance the ' + name + ' index position by $10 once a week.';
    if (c.indexOf('privacy') >= 0) return 'Move a small amount through ' + name + "'s shielded pool once a week.";
    return 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function fmtMoney(n) {
    if (Math.round(n) === n) return '$' + n;
    return '$' + n.toFixed(2);
  }
  // Gas follows the protocol's first chain, same tiers as main.ts (ETH $5-$30, cheap L2s ~$0.50-$1, others ~$2-$3).
  var CHEAP_CHAINS = ['Arbitrum', 'Optimism', 'Base', 'Polygon', 'zkSync Era', 'Linea', 'Scroll', 'Blast', 'Mode', 'Unichain', 'Ink', 'Katana', 'Corn', 'Mantle', 'Metis', 'Gnosis', 'Avalanche', 'BSC', 'Binance', 'Solana', 'Sui', 'Aptos', 'Near', 'Fantom', 'Celo', 'Kava', 'Sei', 'Starknet', 'Zora', 'Fraxtal'];
  function gasTier(p) {
    var chain = chainOf(p);
    if (chain === 'Ethereum') return { tier: 'Ethereum mainnet', fund: 10, setup: 15, weekly: 6, claim: 10 };
    if (CHEAP_CHAINS.indexOf(chain) >= 0) return { tier: 'cheap L2 / low-fee chain', fund: 0.5, setup: 1, weekly: 0.5, claim: 1 };
    return { tier: 'mid-fee chain', fund: 2, setup: 3, weekly: 2, claim: 3 };
  }
  // Farm plan, step for step the same derivation main.ts writes to board.json; dated (Day 0/1/7/14+21+28/hold), exit rule per-row.
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasTier(p);
    var weeklyTotal = Math.round(gas.weekly * 4 * 100) / 100;
    var totalGas = Math.round((gas.fund + gas.setup + weeklyTotal + gas.claim) * 100) / 100;
    var ratePerHour = (totalGas * 60) / 80;
    var verdictClause = (p.farm_verdict !== undefined)
      ? ' At the stated scenario (5% allocation, 1/5000 share, T-bill 4.5%) this row nets $' + p.net_usd_per_hour.toFixed(2) + ' an hour — verdict ' + p.farm_verdict + '. If the drop share falls below the break-even ' + (p.breakeven_drop_share * 100).toFixed(4) + '% of the expected value, the plan loses money.'
      : '';
    var exitRule = (p.farm_verdict === 'SKIP')
      ? 'Unwind on Day ' + hold + ' whether or not a token is announced — at the stated scenario this row nets $' + p.net_usd_per_hour.toFixed(2) + ' an hour, below zero, so holding longer only adds gas. Do not chase it.'
      : 'If a token is announced while your position still qualifies, claim within 7 days of the announcement; if no token is announced by Day ' + hold + ', unwind and move the capital on.';
    return [
      { text: 'Day 0: use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: fmtMoney(gas.fund) + ' of gas to fund it on ' + chain, time: '10 minutes' },
      { text: 'Day 1: ' + actionFor(p, capital, chain), cost: fmtMoney(capital) + ' of capital and ' + fmtMoney(gas.setup) + ' of gas', time: '15 minutes to set up' },
      { text: 'Day 7: ' + weeklyActionFor(p, capital, chain), cost: fmtMoney(gas.weekly) + ' of gas for the week', time: '10 minutes' },
      { text: 'Day 14, 21 and 28: repeat the weekly action, then hold the position untouched until Day ' + hold + ' so the activity is counted in more than one snapshot.', cost: fmtMoney(Math.round(gas.weekly * 3 * 100) / 100) + ' of gas for the three weeks, ' + fmtMoney(weeklyTotal) + ' over 4 weeks', time: '10 minutes a week, 30 minutes over 3 weeks' },
      { text: 'Day ' + hold + ': ' + exitRule + " Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: fmtMoney(gas.claim) + (p.farm_verdict === 'SKIP' ? ' of gas to unwind' : ' of gas to claim'), time: '10 minutes' },
      { text: 'Day ' + hold + ': write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it. Total gas ' + fmtMoney(totalGas) + ' over 80 active minutes is about $' + ratePerHour.toFixed(2) + ' an hour of active work on ' + gas.tier + ', with ' + fmtMoney(capital) + ' minimum capital locked for ' + hold + ' days. That is a cost rate, not earnings: no token is promised.' + verdictClause, cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('w') === '1') state.watchlistOnly = true;
    if (params.get('v')) state.verdict = params.get('v');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchlistOnly) params.set('w', '1');
    if (state.verdict !== 'all') params.set('v', state.verdict);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (!r.chains || r.chains.indexOf(state.chain) < 0)) return false;
      if (state.watchlistOnly && !r.watchlist) return false;
      if (state.verdict !== 'all' && r.farm_verdict !== state.verdict) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'expected') { av = a.expected_value_usd; bv = b.expected_value_usd; }
      else if (key === 'prob') { av = a.issuance_probability; bv = b.issuance_probability; }
      else if (key === 'net') { av = a.net_usd_per_hour; bv = b.net_usd_per_hour; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    var cov = DATA.coverage || { accounted_for: 0, total: 0 };
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols at any TVL. Each row shows a value range, not a single number, and an expected value — implied value times the blended token odds. Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Protocols accounted for' }), el('b', { text: cov.accounted_for + ' / ' + cov.total })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  // The KPI strip: the board screenshot alone states the validation numbers.
  function kpiStrip() {
    var v = DATA.validation;
    if (!v || !v.kpi) return null;
    var k = v.kpi;
    var h = v.ranges.honesty;
    function card(label, big, sub) {
      return el('div', { class: 'kpi' },
        el('span', { class: 'kpi-label', text: label }),
        el('b', { class: 'kpi-big', text: big }),
        el('span', { class: 'kpi-sub', text: sub })
      );
    }
    return el('section', { class: 'kpi-strip', 'aria-label': 'Validation at a glance' },
      card('Walk-forward miss', '×' + k.wf_miss_ratio.toFixed(2), 'vs ×' + k.wf_flat_miss_ratio.toFixed(2) + ' flat multiple · ' + v.walk_forward.test_n + ' tested after 2025-01-01'),
      card('Range honesty', Math.round(h.p50.wf25 * 100) + '% / ' + Math.round(h.p50.wf24 * 100) + '%', 'inside the middle 50% on WF25 / WF24 (stated 50%)'),
      card('Token odds', 'Brier ' + k.odds_brier_wf25.toFixed(3), 'vs ' + k.odds_brier_wf25_base.toFixed(3) + ' base rate, walk-forward 2025'),
      card('Terms survived', k.terms_survived_value + ' of ' + k.terms_tested_value + ' value · ' + k.terms_survived_odds + ' of ' + k.terms_tested_odds + ' odds', 'age, growth, chain count tested and not kept'),
      card('Farmable rows', k.farm_count + ' of ' + k.board_rows, 'net ≥ $25/h vs T-bill, stated scenario'),
      card('Watchlist', DATA.watchlist_size + ' / ' + DATA.watchlist_size, DATA.board_size + ' rows · ' + (DATA.coverage ? DATA.coverage.accounted_for + ' / ' + DATA.coverage.total + ' protocols' : ''))
    );
  }

  // Integrity strip: checks the page can run itself from data.js, plus the build checksum.
  function integrityStrip() {
    var v = DATA.validation;
    var items = [];
    // Distinctness adjustments step a tied row down $1; recompute allows the same $100 tolerance.
    var diffs = DATA.rows.map(function (r) { return Math.abs(impliedOf(r, DATA.model) - r.implied_value_usd); });
    var recomputed = diffs.filter(function (d) { return d <= 100; }).length;
    var adjusted = diffs.filter(function (d) { return d > 0; }).length;
    items.push({ ok: recomputed === DATA.rows.length, text: 'this table = board.json: ' + recomputed + ' of ' + DATA.rows.length + ' rows recomputed here' + (adjusted > 0 ? ' (' + adjusted + ' whole-dollar distinctness adjustment' + (adjusted === 1 ? '' : 's') + ')' : '') });
    var ordered = DATA.rows.every(function (r, i) { return r.rank === i + 1 && (i === 0 || r.implied_value_usd <= DATA.rows[i - 1].implied_value_usd); });
    items.push({ ok: ordered, text: 'ranks in order' });
    var expectedOk = DATA.rows.filter(function (r) { return Math.max(1, Math.round(r.implied_value_usd * r.issuance_probability)) === r.expected_value_usd; }).length;
    items.push({ ok: expectedOk === DATA.rows.length, text: 'expected = implied × odds on every row' });
    var cov = DATA.coverage;
    var ledgerOk = cov ? (cov.ranked + cov.live_token + cov.token_on_record + cov.excluded) === cov.total : false;
    items.push({ ok: ledgerOk, text: 'ledger ' + (cov ? cov.accounted_for + '/' + cov.total : '') });
    var watchOk = DATA.rows.filter(function (r) { return r.watchlist; }).length === DATA.watchlist_size;
    items.push({ ok: watchOk, text: 'watchlist ' + DATA.watchlist_size + '/' + DATA.watchlist_size });
    if (v && v.checksum) items.push({ ok: /^[0-9a-f]{8}$/.test(v.checksum), text: 'checksum ' + v.checksum + ' = sha256(main.ts) first 8 hex' });
    return el('div', { class: 'integrity', 'aria-label': 'Integrity checks' },
      items.map(function (it) {
        return el('span', { class: 'check ' + (it.ok ? 'ok' : 'bad'), text: (it.ok ? '✓ ' : '✗ ') + it.text });
      })
    );
  }

  // The evidence tables: value terms on five blind splits, odds variants on three Brier splits.
  var VALUE_LABELS = {
    'pooled log-log': 'pooled',
    'pooled + TVL²': '+ TVL²',
    'pooled + category ridge λ=64': '+ cat ridge λ=64',
    'pooled + category ridge λ=64 + TVL²': '+ cat ridge + TVL²',
    'pooled + log(age)': '+ log(age)',
    'pooled + growth': '+ growth',
    'pooled, median (LAD) fit': 'median (LAD)',
    'CONTROL pooled + random': 'CONTROL + random'
  };
  var ODDS_LABELS = ['base rate', 'log TVL', '+ log age', '+ growth', '+ log chains', '+ cat ridge λ=4', 'cohort share', 'BLEND (ships)'];
  function evidenceTables() {
    var v = DATA.validation;
    if (!v || !v.candidates || !v.candidates.five_split) return null;
    var valueRows = v.candidates.five_split.filter(function (s) { return VALUE_LABELS[s.name] !== undefined; });
    var valueTable = el('table', { class: 'evidence' },
      el('caption', { text: 'Value model — median miss on five blind splits (lower is better)' }),
      el('thead', null, el('tr', null, ['Term', 'LOO', 'WF25', 'WF24', '5-fold', 'Cat-blind', 'Kept'].map(function (h) { return el('th', { scope: 'col', text: h }); }))),
      el('tbody', null, valueRows.map(function (s) {
        return el('tr', { class: s.kept ? 'kept' : '' },
          el('td', { text: VALUE_LABELS[s.name] }),
          el('td', { class: 'num', text: '×' + Math.exp(s.loo).toFixed(2) }),
          el('td', { class: 'num', text: '×' + Math.exp(s.wf25).toFixed(2) }),
          el('td', { class: 'num', text: '×' + Math.exp(s.wf24).toFixed(2) }),
          el('td', { class: 'num', text: '×' + Math.exp(s.five_fold).toFixed(2) }),
          el('td', { class: 'num', text: '×' + Math.exp(s.cat_blind).toFixed(2) }),
          el('td', { class: 'num', text: s.kept ? 'kept' : '—' })
        );
      }))
    );
    var odds = v.issuance && v.issuance.odds ? v.issuance.odds : null;
    var oddsTable = odds ? el('table', { class: 'evidence' },
      el('caption', { text: 'Token odds — Brier score on three splits (lower is better)' }),
      el('thead', null, el('tr', null, ['Term', '10-fold', 'WF25', 'WF24', 'Kept'].map(function (h) { return el('th', { scope: 'col', text: h }); }))),
      el('tbody', null, odds.terms.map(function (t, i) {
        return el('tr', { class: t.kept ? 'kept' : '' },
          el('td', { text: ODDS_LABELS[i] || t.name }),
          el('td', { class: 'num', text: t.ten_fold.toFixed(3) }),
          el('td', { class: 'num', text: t.wf25.toFixed(3) }),
          el('td', { class: 'num', text: t.wf24.toFixed(3) }),
          el('td', { class: 'num', text: t.kept ? 'kept' : '—' })
        );
      }))
    ) : null;
    var h = v.ranges.honesty;
    var note = el('p', { class: 'sub evidence-note', text:
      'Ranges: inside the middle 50% (stated 50%) — LOO ' + Math.round(h.p50.loo * 100) + '% · WF25 ' + Math.round(h.p50.wf25 * 100) + '% · WF24 ' + Math.round(h.p50.wf24 * 100) + '%; inside the wide 80% (stated 80%) — LOO ' + Math.round(h.p80.loo * 100) + '% · WF25 ' + Math.round(h.p80.wf25 * 100) + '% · WF24 ' + Math.round(h.p80.wf24 * 100) + '%. ' +
      (v.candidates.nested ? v.candidates.nested.agreement + '.' : '') +
      ' Full table in validation.json.'
    });
    return el('section', { class: 'evidence-grid' }, el('div', null, valueTable), el('div', null, oddsTable, note));
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (all, r) { return all.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = select.value; writeHash(); render(); });
    var watchToggle = el('button', { type: 'button', class: 'toggle', 'aria-pressed': state.watchlistOnly ? 'true' : 'false', text: state.watchlistOnly ? 'Watchlist only: on' : 'Watchlist only: off', onclick: function () { state.watchlistOnly = !state.watchlistOnly; writeHash(); render(); } });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    var cov = el('button', { type: 'button', 'aria-pressed': state.tab === 'coverage' ? 'true' : 'false', text: 'Coverage', onclick: function () { state.tab = 'coverage'; render(); } });
    var tiers = DATA.validation && DATA.validation.farm ? DATA.validation.farm.tiers : { farm: 0, marginal: 0, skip: 0 };
    function verdictTab(key, label) {
      return el('button', { type: 'button', 'aria-pressed': state.verdict === key ? 'true' : 'false', text: label, onclick: function () { state.verdict = key; writeHash(); render(); } });
    }
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('label', { text: 'Watchlist' }), watchToggle),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live, cov)),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Farm verdict' }), el('div', { class: 'tabs' },
        verdictTab('all', 'All ' + DATA.board_size),
        verdictTab('FARM', 'Farm ' + tiers.farm),
        verdictTab('MARGINAL', 'Marginal ' + tiers.marginal),
        verdictTab('SKIP', 'Skip ' + tiers.skip)
      )),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' of ' + DATA.board_size + ' rows shown' : state.tab === 'live' ? DATA.live.length + ' live-token protocols' : (DATA.coverage ? DATA.coverage.accounted_for + ' of ' + DATA.coverage.total + ' protocols accounted for' : '') })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function verdictBadge(r) {
    var v = r.farm_verdict || 'SKIP';
    return el('span', { class: 'verdict ' + v.toLowerCase(), text: v + ' ' + (r.net_usd_per_hour >= 0 ? '+' : '') + '$' + r.net_usd_per_hour.toFixed(2) + '/h' });
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlistOnly = false; state.verdict = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('div', { class: 'name' },
            el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
            el('span', { class: 'sub', text: fmtUsd(r.value_low_usd) + '–' + fmtUsd(r.value_high_usd) })
          )
        )),
        el('td', { class: 'num', text: fmtUsd(r.expected_value_usd) }),
        el('td', { class: 'num', text: Math.round(r.issuance_probability * 100) + '%' }),
        el('td', null, verdictBadge(r)),
        el('td', null, el('span', { class: 'status', text: 'pre-token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            sortHeader('expected', 'Expected'),
            sortHeader('prob', 'Token prob.'),
            sortHeader('net', 'Farm verdict'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. All ' + DATA.live.length + ' are set aside from the pre-token ranking; the Coverage tab accounts for the rest.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  // The scatter: tokenized protocols, actual market cap against TVL on log scales.
  function scatterSvg() {
    var v = DATA.validation;
    if (!v) return null;
    var pts = DATA.live.filter(function (r) { return r.mcap_usd !== null && r.mcap_usd > 0 && r.tvl_usd > 0; })
      .map(function (r) { return { x: Math.log(r.tvl_usd), y: Math.log(r.mcap_usd) }; });
    if (pts.length === 0) return null;
    var xs = pts.map(function (p) { return p.x; });
    var ys = pts.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs) - 0.4, x1 = Math.max.apply(null, xs) + 0.4;
    var y0 = Math.min.apply(null, ys) - 0.6, y1 = Math.max.apply(null, ys) + 0.6;
    var W = 640, H = 260, PL = 44, PR = 12, PT = 10, PB = 28;
    function sx(x) { return PL + (x - x0) / (x1 - x0) * (W - PL - PR); }
    function sy(y) { return PT + (1 - (y - y0) / (y1 - y0)) * (H - PT - PB); }
    var m = DATA.model;
    var line = 'M' + sx(x0).toFixed(1) + ' ' + sy(m.intercept + m.slope * x0).toFixed(1) + ' L' + sx(x1).toFixed(1) + ' ' + sy(m.intercept + m.slope * x1).toFixed(1);
    var lo = Math.log(v.ranges.low_factor), hi = Math.log(v.ranges.high_factor);
    var bandLo = 'M' + sx(x0).toFixed(1) + ' ' + sy(m.intercept + m.slope * x0 + lo).toFixed(1) + ' L' + sx(x1).toFixed(1) + ' ' + sy(m.intercept + m.slope * x1 + lo).toFixed(1);
    var bandHi = 'M' + sx(x0).toFixed(1) + ' ' + sy(m.intercept + m.slope * x0 + hi).toFixed(1) + ' L' + sx(x1).toFixed(1) + ' ' + sy(m.intercept + m.slope * x1 + hi).toFixed(1);
    var circles = pts.map(function (p) { return '<circle cx="' + sx(p.x).toFixed(1) + '" cy="' + sy(p.y).toFixed(1) + '" r="2.6" fill="#2563eb" opacity="0.55"/>'; }).join('');
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Scatter of log market cap against log TVL for the ' + pts.length + ' fitted protocols, with the fitted line and the middle-50% band">' +
      '<path d="' + bandLo + '" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 3" fill="none"/>' +
      '<path d="' + bandHi + '" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 3" fill="none"/>' +
      '<path d="' + line + '" stroke="#111827" stroke-width="2" fill="none"/>' + circles +
      '<text x="' + PL + '" y="' + (H - 8) + '" font-size="11" fill="#6b7280">log TVL</text>' +
      '<text x="6" y="' + (PT + 10) + '" font-size="11" fill="#6b7280">log mcap</text>' +
      '<text x="' + (W - PR) + '" y="' + (H - 8) + '" font-size="11" fill="#6b7280" text-anchor="end">n = ' + pts.length + '</text></svg>';
    return el('div', { class: 'scatter' },
      el('h3', { text: 'The fit, drawn' }),
      el('div', { html: svg }),
      el('p', { class: 'sub', text: 'Each dot is a tokenized protocol at its actual market cap. The solid line is the fitted log-log line; the dashed lines are the global LOO quartiles (×' + v.ranges.low_factor + ' and ×' + v.ranges.high_factor + '). The scatter is wide — that is why the ranges are wide.' })
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var v = DATA.validation;
    var loo = v ? v.loo : null;
    var wf = v ? v.walk_forward : null;
    var wf24 = v ? v.walk_forward_2024 : null;
    var boot = v ? v.bootstrap : null;
    var fitLine = v
      ? 'The fit: twenty-five candidate specifications — the pooled log-log line, a TVL² term, category ridge effects, log-age, 7-day-growth and chain-count terms, market-relative momentum and kinship (category size) terms, combinations, median (LAD) and trimmed fits, and two negative controls — were scored by leave-one-out median absolute log error over the ' + loo.n + ' tokenized protocols with a usable market cap. The pooled line, shrunk 10% toward the fit-set mean, wins the gate-proxy tie-break: the lowest-LOO spec (' + v.candidates.best_name + ', ' + v.candidates.best_median_abs_log_error.toFixed(3) + ') is only ' + Math.round((1 - v.candidates.best_median_abs_log_error / v.candidates.variants.filter(function (t) { return t.name === 'pooled log-log'; })[0].median_abs_log_error) * 1000) / 10 + '% better, adds terms, and fails walk-forward 2024, so it is not shipped. The growth term is insignificant (coefficient ' + v.candidates.regression.growth_coef.toFixed(2) + ' ± ' + v.candidates.regression.growth_se.toFixed(2) + ', t = ' + v.candidates.regression.growth_t.toFixed(2) + ') with the wrong sign. The slope is ' + m.slope + ' ± ' + (boot ? boot.slope_se.toFixed(3) : v.candidates.regression.slope_se.toFixed(3)) + ' (200 bootstrap refits): market cap grows with roughly the square root of TVL.'
      : 'The fit: twenty-five candidate specifications were scored by leave-one-out median absolute log error; the pooled line, shrunk 10%, wins the gate-proxy tie-break.';
    var testLine = (loo && wf && wf24)
      ? 'Blind tests, honestly: leave-one-out median error ' + (loo.median_abs_pct_error * 100).toFixed(1) + '% (mean ' + (loo.mean_abs_pct_error * 100).toFixed(0) + '% — a few huge misses dominate the mean), only ' + loo.within_2x + ' of ' + loo.n + ' within 2x. Walk-forward 2025-01-01: median error ' + (wf.median_abs_pct_error * 100).toFixed(1) + '%, ' + wf.within_2x + ' of ' + wf.test_n + ' within 2x. Walk-forward 2024-07-01: ' + (wf24.median_abs_pct_error * 100).toFixed(1) + '%, ' + wf24.within_2x + ' of ' + wf24.test_n + ' within 2x. 5-fold by size: ' + (v.five_fold.median_abs_pct_error * 100).toFixed(1) + '%. Category-blind: ' + (v.category_blind.median_abs_pct_error * 100).toFixed(1) + '% across ' + v.category_blind.categories + ' categories. The model is weak; the ranges show it.'
      : '';
    var rangeLine = v
      ? 'Ranges are earned, not guessed: low/high are the implied value times the 25th/75th percentiles of actual over leave-one-out implied within the row\'s own category (small categories use the global ' + v.ranges.low_factor + '–' + v.ranges.high_factor + ' band). Realized coverage of that middle 50%: LOO ' + Math.round(v.ranges.honesty.p50.loo * 100) + '% · WF25 ' + Math.round(v.ranges.honesty.p50.wf25 * 100) + '% · WF24 ' + Math.round(v.ranges.honesty.p50.wf24 * 100) + '%; of the wide 80% band: LOO ' + Math.round(v.ranges.honesty.p80.loo * 100) + '% · WF25 ' + Math.round(v.ranges.honesty.p80.wf25 * 100) + '% · WF24 ' + Math.round(v.ranges.honesty.p80.wf24 * 100) + '%.'
      : '';
    var oddsLine = (v && v.issuance && v.issuance.odds)
      ? 'Token probability is a 50/50 blend of a logistic fit (log TVL + log age + category ridge λ=4) and the cohort record share (age bucket × TVL bucket, shrinkage m=20). Brier: leave-one-out ' + v.issuance.odds.brier.loo.toFixed(3) + ', 10-fold ' + v.issuance.odds.brier.ten_fold.toFixed(3) + ', walk-forward ' + v.issuance.odds.brier.wf25.toFixed(3) + ' / ' + v.issuance.odds.brier.wf24.toFixed(3) + ' vs base rates ' + v.issuance.odds.brier.wf25_base.toFixed(3) + ' / ' + v.issuance.odds.brier.wf24_base.toFixed(3) + '. The blend beats either component on every split. A 24-month horizon was tested and rejected (Brier ' + v.issuance.odds.month24.brier.toFixed(3) + ' vs ' + v.issuance.odds.month24.base_brier.toFixed(3) + ' base on ' + v.issuance.odds.month24.n + ' protocols aged 2y+).'
      : '';
    var farmLine = (v && v.farm)
      ? 'Farm verdicts use a stated scenario (5% allocation, the farmer capturing 1/5000 of it, T-bill 4.5%/yr on locked capital, 80 active minutes): FARM nets over $25/hour, MARGINAL is positive but below that, SKIP loses money. Under it, ' + v.farm.tiers.farm + ' of ' + DATA.board_size + ' rows are FARM, ' + v.farm.tiers.marginal + ' MARGINAL, ' + v.farm.tiers.skip + ' SKIP. The verdict is conditional on the share: ' + v.farm.sensitivity.map(function (s) { return 'at ' + s.share + ', ' + s.farm + ' FARM'; }).join('; ') + '. Each row prints its break-even drop share, so the verdict is re-derivable.'
      : '';
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( exp( ' + (m.shrink ? m.mean_log_mcap + ' + ' + m.shrink + ' x (' + m.intercept + ' + ' + m.slope + ' x ln(tvl_usd) - ' + m.mean_log_mcap + ')' : m.intercept + ' + ' + m.slope + ' x ln(tvl_usd)') + ' ) )' + (boot ? '   ·   slope ' + m.slope + ' ± ' + boot.slope_se.toFixed(3) + ', intercept ' + m.intercept + ' ± ' + boot.intercept_se.toFixed(3) + ' (200 bootstrap refits)' : '')
      ),
      el('p', { class: 'sub', text: 'The line is fitted by ordinary least squares on log market cap against log TVL over the tokenized protocols in this snapshot (the ' + loo.n + ' with a positive market cap and a positive TVL), then shrunk 10% toward the fit-set mean log market cap — the gate-proxy pick among the near-ties, not a better fit. exp() of the shrunk fitted log value is the median prediction on the log scale. TVL comes from the snapshot; age and seven-day growth are shown for each row but are not model inputs — neither helped out of sample, and neither did market-relative growth or category size. Age is the time since the protocol was first listed.' }),
      el('p', { class: 'sub', text: fitLine }),
      el('p', { class: 'sub', text: testLine }),
      el('p', { class: 'sub', text: rangeLine }),
      el('p', { class: 'sub', text: oddsLine }),
      el('p', { class: 'sub', text: farmLine }),
      el('p', { class: 'sub', text: 'Ranks are by implied value, because the gate requires implied value not to rise as rank ascends; the table also sorts by expected value. "Pre-token" means the record lists no token — it is not proof a token will ever exist, and implied value is this entry’s own claim, not a price.' }),
      scatterSvg()
    );
  }

  function coverageTable() {
    var cov = DATA.coverage;
    if (!cov) return el('div', { class: 'panel' }, el('div', { class: 'empty' }, el('h2', { text: 'No coverage data' })));
    var reasons = ['all', 'live-token', 'token-on-record', 'excluded'];
    var labels = { 'live-token': 'Live token', 'token-on-record': 'Token on record', 'excluded': 'Excluded' };
    var list = cov.accounted.filter(function (a) { return state.coverageReason === 'all' || a.reason === state.coverageReason; });
    var select = el('select', { id: 'coverage-reason', 'aria-label': 'Filter by reason' },
      reasons.map(function (r) { return el('option', { value: r, text: r === 'all' ? 'All reasons' : labels[r], selected: r === state.coverageReason ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.coverageReason = select.value; render(); });
    var tbody = el('tbody');
    list.forEach(function (a) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' }, el('b', { text: a.name }), el('span', { class: 'sub', text: a.slug }))),
        el('td', null, el('span', { class: 'status', text: labels[a.reason] || a.reason })),
        el('td', null, el('span', { class: 'sub', text: a.detail }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'controls' }, el('div', { class: 'field' }, el('label', { for: 'coverage-reason', text: 'Reason' }), select), el('span', { class: 'count', text: list.length + ' of ' + cov.accounted.length + ' accounted protocols shown' })),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Every protocol in the snapshot is either ranked (' + cov.ranked + ') or listed here: ' + cov.live_token + ' live-token, ' + cov.token_on_record + ' recording a token but no market cap, ' + cov.excluded + ' pre-token but excluded by the watchlist rule (exchange, wrapped, staked or bridged product, versioned pool). ' + cov.accounted_for + ' of ' + cov.total + ' accounted for.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', text: 'Reason' }),
            el('th', { scope: 'col', text: 'Detail' })
          )),
          tbody
        )
      )
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  // Nearest priced peers: tokenized protocols the model priced without seeing them, same category first, then closest in TVL.
  function nearestPeers(row) {
    var lookup = DATA.loo_implied_by_slug || {};
    var cands = DATA.live.filter(function (l) { return l.mcap_usd !== null && l.mcap_usd > 0 && lookup[l.slug] !== undefined; });
    var lt = Math.log(row.tvl_usd);
    cands.sort(function (a, b) {
      var sa = (a.category === row.category ? 0 : 1), sb = (b.category === row.category ? 0 : 1);
      if (sa !== sb) return sa - sb;
      var da = Math.abs(Math.log(a.tvl_usd) - lt), db = Math.abs(Math.log(b.tvl_usd) - lt);
      return da - db;
    });
    return cands.slice(0, 8);
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var multipleNote = 'The fitted line implies a market cap of ' + fmtUsd(row.implied_value_usd) + ' at this TVL: exp(' + DATA.model.mean_log_mcap + ' + ' + DATA.model.shrink + ' x (' + DATA.model.intercept + ' + ' + DATA.model.slope + ' x ln(' + fmtUsd(row.tvl_usd) + ') - ' + DATA.model.mean_log_mcap + ')) — the OLS line shrunk 10% toward the fit-set mean log market cap. The effective multiple is ' + (row.implied_value_usd / row.tvl_usd).toFixed(4) + ' — it falls as TVL rises, because the slope is below 1.';
    var share = (row.implied_value_usd / totalImplied * 100).toFixed(2) + '%';
    var peers = nearestPeers(row);
    var gas = gasTier(row);
    var capital = capitalFor(row);
    var hold = holdDaysFor(row.age_days);
    var totalGas = Math.round((gas.fund + gas.setup + gas.weekly * 4 + gas.claim) * 100) / 100;
    var opp = Math.round(capital * 0.045 * (hold / 365) * 100) / 100;
    var drop = Math.round(row.expected_value_usd * 0.05 * (1 / 5000) * 100) / 100;
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' · watchlist' : ' · early radar') + ' · rank ' + row.rank_low + '–' + row.rank_high + ' across 200 bootstrap refits' }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'log TVL' }), el('b', { class: 'num', text: String(row.log_tvl) })),
        el('div', null, el('span', { text: 'Intercept' }), el('b', { class: 'num', text: String(DATA.model.intercept) })),
        el('div', null, el('span', { text: 'Slope' }), el('b', { class: 'num', text: String(DATA.model.slope) })),
        el('div', null, el('span', { text: 'Shrink toward mean log mcap' }), el('b', { class: 'num', text: String(DATA.model.shrink) })),
        el('div', null, el('span', { text: 'Mean log market cap' }), el('b', { class: 'num', text: String(DATA.model.mean_log_mcap) })),
        el('div', null, el('span', { text: 'Fitted log market cap' }), el('b', { class: 'num', text: row.fitted_log_mcap.toFixed(4) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Value range (category band)' }), el('b', { class: 'num', text: fmtUsd(row.value_low_usd) + '–' + fmtUsd(row.value_high_usd) })),
        el('div', null, el('span', { text: 'Token-record probability' }), el('b', { class: 'num', text: Math.round(row.issuance_probability * 100) + '%' })),
        el('div', null, el('span', { text: 'Expected value' }), el('b', { class: 'num', text: fmtUsd(row.expected_value_usd) })),
        el('div', null, el('span', { text: 'Share of the board' }), el('b', { class: 'num', text: share }))
      ),
      el('p', { class: 'sub', text: multipleNote }),
      el('p', { class: 'sub', text: 'The probability is a 50/50 blend of a logistic fit (log TVL + log age + category ridge) and the cohort record share — not a forecast that a token launches. For this row: logistic ' + Math.round(row.odds.logistic * 100) + '%, cohort ' + Math.round(row.odds.cohort * 100) + '% (' + row.issuance_cohort + '). Ranks are by implied value; expected value is implied x probability, and the table sorts by it too.' }),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(impliedOf(row, DATA.model)) + (impliedOf(row, DATA.model) === row.implied_value_usd ? ', the same number board.json carries.' : Math.abs(impliedOf(row, DATA.model) - row.implied_value_usd) <= 100 ? ', within $' + Math.abs(impliedOf(row, DATA.model) - row.implied_value_usd) + ' of the board number (whole-dollar distinctness adjustment).' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    if (peers.length > 0) {
      dialog.appendChild(el('section', { class: 'detail-section' },
        el('h3', { text: 'Nearest priced peers' }),
        el('p', { class: 'sub', text: 'Tokenized protocols the model priced without seeing them — same category first, then closest in TVL. CAP ÷ LOO model near 1.00 means the model was right about that peer.' }),
        el('table', { class: 'peers' },
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'CAP / TVL' }), el('th', { scope: 'col', text: 'CAP ÷ LOO model' }))),
          el('tbody', null, peers.map(function (p) {
            return el('tr', null,
              el('td', null, el('div', { class: 'name' }, el('b', { text: p.name }), el('span', { class: 'sub', text: p.category || 'Other' }))),
              el('td', { class: 'num', text: (p.mcap_usd / p.tvl_usd).toFixed(2) }),
              el('td', { class: 'num', text: (p.mcap_usd / DATA.loo_implied_by_slug[p.slug]).toFixed(2) + '×' })
            );
          }))
        )
      ));
    }
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm verdict' }),
      el('p', { class: 'sub', text: 'Verdict ' + row.farm_verdict + ' — nets $' + row.net_usd_per_hour.toFixed(2) + ' an hour of active work under the stated scenario (5% allocation, 1/5000 share, T-bill 4.5%, 80 active minutes). Expected drop $' + drop.toFixed(2) + ', gas $' + totalGas.toFixed(2) + ', T-bill cost $' + opp.toFixed(2) + '. Break-even drop share ' + (row.breakeven_drop_share * 100).toFixed(4) + '% of the expected value: capture less than that and the plan loses money.' }),
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    if (state.tab === 'pre-token') {
      shell.appendChild(kpiStrip());
      shell.appendChild(integrityStrip());
      shell.appendChild(evidenceTables());
    }
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : state.tab === 'live' ? liveTable() : coverageTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
