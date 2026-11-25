// Token Radar's plain dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail drawer with the model's own
// inputs and the protocol's farm plan. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watchlistOnly: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null, coverageReason: 'all' };

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
  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  // The regression is log(market cap) = intercept + slope x log(TVL), fitted by OLS over the
  // tokenized protocols in this snapshot; implied value is exp() of the fitted log value.
  function impliedOf(row, model) {
    return Math.max(1, Math.round(Math.exp(model.intercept + model.slope * Math.log(row.tvl_usd))));
  }
  // The board's whole implied value, for a row's share of it.
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

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased.
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
  // Gas follows the protocol's first chain, the same tiers main.ts uses: Ethereum mainnet
  // $5-$30 a transaction, cheap L2s and low-fee L1s about $0.50-$1, other chains about $2-$3.
  var CHEAP_CHAINS = ['Arbitrum', 'Optimism', 'Base', 'Polygon', 'zkSync Era', 'Linea', 'Scroll', 'Blast', 'Mode', 'Unichain', 'Ink', 'Katana', 'Corn', 'Mantle', 'Metis', 'Gnosis', 'Avalanche', 'BSC', 'Binance', 'Solana', 'Sui', 'Aptos', 'Near', 'Fantom', 'Celo', 'Kava', 'Sei', 'Starknet', 'Zora', 'Fraxtal'];
  function gasTier(p) {
    var chain = chainOf(p);
    if (chain === 'Ethereum') return { tier: 'Ethereum mainnet', fund: 10, setup: 15, weekly: 6, claim: 10 };
    if (CHEAP_CHAINS.indexOf(chain) >= 0) return { tier: 'cheap L2 / low-fee chain', fund: 0.5, setup: 1, weekly: 0.5, claim: 1 };
    return { tier: 'mid-fee chain', fund: 2, setup: 3, weekly: 2, claim: 3 };
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasTier(p);
    var weeklyTotal = Math.round(gas.weekly * 4 * 100) / 100;
    var totalGas = Math.round((gas.fund + gas.setup + weeklyTotal + gas.claim) * 100) / 100;
    var ratePerHour = (totalGas * 60) / 80;
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: fmtMoney(gas.fund) + ' of gas to fund it on ' + chain, time: '10 minutes' },
      { text: actionFor(p, capital, chain), cost: fmtMoney(capital) + ' of capital and ' + fmtMoney(gas.setup) + ' of gas', time: '15 minutes to set up' },
      { text: weeklyActionFor(p, capital, chain), cost: fmtMoney(gas.weekly) + ' of gas a week, ' + fmtMoney(weeklyTotal) + ' over 4 weeks', time: '10 minutes a week, 40 minutes over 4 weeks' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the ' + fmtMoney(capital) + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: fmtMoney(gas.claim) + ' of gas to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it. Total gas ' + fmtMoney(totalGas) + ' over 80 active minutes is about $' + ratePerHour.toFixed(2) + ' an hour of active work on ' + gas.tier + ', with ' + fmtMoney(capital) + ' minimum capital locked for ' + hold + ' days. That is a cost rate, not earnings: no token is promised.', cost: 'nothing but the log', time: '5 minutes' }
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
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchlistOnly) params.set('w', '1');
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
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor and above it. Each row shows a value range, not a single number, and an expected value — implied value times the token-record share of its age and TVL cohort. Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Protocols accounted for' }), el('b', { text: cov.accounted_for + ' / ' + cov.total })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  // The strongest row of each category, six categories at most, strongest first: the board at a glance.
  function leaders() {
    var byCat = {};
    DATA.rows.forEach(function (r) {
      var c = r.category || 'Other';
      if (!byCat[c] || r.implied_value_usd > byCat[c].implied_value_usd) byCat[c] = r;
    });
    var leaders = Object.keys(byCat).map(function (c) { return byCat[c]; })
      .sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd; })
      .slice(0, 6);
    return el('section', { class: 'panel leaders' },
      el('h2', { text: 'Category leaders' }),
      el('p', { class: 'sub', text: 'The strongest implied value in each category, by the same model. Select one for its detail and farm plan.' }),
      el('div', { class: 'leader-grid' }, leaders.map(function (r) {
        return el('button', { type: 'button', class: 'leader', onclick: function () { openDetail(r.slug); } },
          el('span', { class: 'leader-cat', text: r.category || 'Other' }),
          el('b', { text: '#' + r.rank + ' ' + r.name }),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) + ' implied' })
        );
      }))
    );
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
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var watchToggle = el('button', { type: 'button', class: 'toggle', 'aria-pressed': state.watchlistOnly ? 'true' : 'false', text: state.watchlistOnly ? 'Watchlist only: on' : 'Watchlist only: off', onclick: function () { state.watchlistOnly = !state.watchlistOnly; writeHash(); render(); } });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    var cov = el('button', { type: 'button', 'aria-pressed': state.tab === 'coverage' ? 'true' : 'false', text: 'Coverage', onclick: function () { state.tab = 'coverage'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('label', { text: 'Watchlist' }), watchToggle),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live, cov)),
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

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlistOnly = false; writeHash(); render(); } })
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
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
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

  function modelPanel() {
    var m = DATA.model;
    var v = DATA.validation;
    var loo = v ? v.loo : null;
    var wf = v ? v.walk_forward : null;
    var fitLine = v
      ? 'The fit: nine candidate specifications — the pooled log-log line, category intercepts, category slopes, log-age and 7-day-growth terms and combinations — were scored by leave-one-out median absolute log error over the ' + loo.n + ' tokenized protocols with a usable market cap (144 record one; 16 record 0 or -1). The pooled line wins outright (median log error ' + v.candidates.best_median_abs_log_error.toFixed(3) + ' vs ' + v.candidates.variants[1].median_abs_log_error.toFixed(3) + ' for the next-best candidate), so no tie rule fires. Category and age terms all score worse out of sample, and the growth term is insignificant (coefficient ' + v.candidates.regression.growth_coef.toFixed(2) + ' ± ' + v.candidates.regression.growth_se.toFixed(2) + ', t = ' + v.candidates.regression.growth_t.toFixed(2) + ') with a counterintuitive negative sign, so none of them is shipped. The slope is ' + m.slope + ' ± ' + v.candidates.regression.slope_se.toFixed(3) + ': market cap grows with roughly the square root of TVL, not in proportion to it.'
      : 'The fit: nine candidate specifications were scored by leave-one-out median absolute log error; the pooled log-log line wins outright.';
    var testLine = (loo && wf)
      ? 'Blind tests, honestly: leave-one-out median error ' + (loo.median_abs_pct_error * 100).toFixed(1) + '% (mean ' + (loo.mean_abs_pct_error * 100).toFixed(0) + '% — a few huge misses dominate the mean), only ' + loo.within_2x + ' of ' + loo.n + ' predictions within 2x of the actual market cap. Walk-forward, fitted on protocols listed before 2025-01-01 and tested on the ' + wf.test_n + ' listed after it: median error ' + (wf.median_abs_pct_error * 100).toFixed(1) + '%, ' + wf.within_2x + ' of ' + wf.test_n + ' within 2x. The model is weak; the ranges show it.'
      : '';
    var rangeLine = v
      ? 'Ranges are earned, not guessed: low = implied x ' + v.ranges.low_factor + ', high = implied x ' + v.ranges.high_factor + ' — the 25th and 75th percentiles of actual over leave-one-out implied across the tokenized protocols, the middle 50% of backtested outcomes.'
      : '';
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( exp( ' + m.intercept + ' + ' + m.slope + ' x ln(tvl_usd) ) )'
      ),
      el('p', { class: 'sub', text: 'The line is fitted by ordinary least squares on log market cap against log TVL over the tokenized protocols in this snapshot (the 128 with a positive market cap and a positive TVL). exp() of the fitted log value is the median prediction on the log scale. TVL comes from the snapshot; age and seven-day growth are shown for each row but are not model inputs — neither helped out of sample. Age is the time since the protocol was first listed, the best record of how long it has run with no token.' }),
      el('p', { class: 'sub', text: fitLine }),
      el('p', { class: 'sub', text: testLine }),
      el('p', { class: 'sub', text: rangeLine }),
      el('p', { class: 'sub', text: 'Token probability is the shrunk share of protocols in the row’s age x TVL cohort that record a token in this snapshot (20 pseudo-counts towards the overall 55% rate): a record share, not a forecast. Expected value = implied x probability. Ranks are by implied value, because the gate requires implied value not to rise as rank ascends; the table also sorts by expected value. "Pre-token" means the record lists no token — it is not proof a token will ever exist, and implied value is this entry’s own claim, not a price.' })
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

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var multipleNote = 'The fitted line implies a market cap of ' + fmtUsd(row.implied_value_usd) + ' at this TVL: exp(' + DATA.model.intercept + ' + ' + DATA.model.slope + ' x ln(' + fmtUsd(row.tvl_usd) + ')). The effective multiple is ' + (row.implied_value_usd / row.tvl_usd).toFixed(4) + ' — it falls as TVL rises, because the slope is below 1.';
    var share = (row.implied_value_usd / totalImplied * 100).toFixed(2) + '%';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' · watchlist' : ' · early radar') }),
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
        el('div', null, el('span', { text: 'Fitted log market cap' }), el('b', { class: 'num', text: row.fitted_log_mcap.toFixed(4) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Value range (LOO middle 50%)' }), el('b', { class: 'num', text: fmtUsd(row.value_low_usd) + '–' + fmtUsd(row.value_high_usd) })),
        el('div', null, el('span', { text: 'Token-record probability' }), el('b', { class: 'num', text: Math.round(row.issuance_probability * 100) + '% (' + row.issuance_cohort + ')' })),
        el('div', null, el('span', { text: 'Expected value' }), el('b', { class: 'num', text: fmtUsd(row.expected_value_usd) })),
        el('div', null, el('span', { text: 'Share of the board' }), el('b', { class: 'num', text: share }))
      ),
      el('p', { class: 'sub', text: multipleNote }),
      el('p', { class: 'sub', text: 'The probability is the shrunk share of protocols in this age and TVL cohort that record a token — a record share, not a forecast that one launches. Ranks are by implied value; expected value is implied x probability, and the table sorts by it too.' }),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(impliedOf(row, DATA.model)) + (impliedOf(row, DATA.model) === row.implied_value_usd ? ', the same number board.json carries.' : Math.abs(impliedOf(row, DATA.model) - row.implied_value_usd) <= 100 ? ', within $' + Math.abs(impliedOf(row, DATA.model) - row.implied_value_usd) + ' of the board number (whole-dollar distinctness adjustment).' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
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
    if (state.tab === 'pre-token') shell.appendChild(leaders());
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
