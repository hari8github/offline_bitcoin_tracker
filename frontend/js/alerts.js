/* alerts.js — alert table, status bar, evidence sentences, re-scan */

const Alerts = (() => {
  let _sortKey  = 'confidence';
  let _sortDir  = 'desc';
  let _typeFilter = 'all';
  let _allAlerts  = [];

  async function load() {
    const tbody  = document.getElementById('alerts-tbody');
    const countEl = document.getElementById('alerts-count');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Loading…</td></tr>`;

    try {
      const data = await API.alerts(State.getCase(), _typeFilter === 'all' ? null : _typeFilter);
      _allAlerts = data.alerts || [];
      if (countEl) countEl.textContent = _allAlerts.length;
      _render();
      _renderStatusBar();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--risk-high)">${esc(e.message)}</td></tr>`;
      Utils.toast(e.message, 'error');
    }
  }

  function _render() {
    const tbody = document.getElementById('alerts-tbody');
    if (!tbody) return;

    const sorted = [..._allAlerts].sort((a, b) => {
      let av = a[_sortKey], bv = b[_sortKey];
      if (av == null) av = '';
      if (bv == null) bv = '';
      return _sortDir === 'asc'
        ? (av > bv ? 1 : av < bv ? -1 : 0)
        : (av < bv ? 1 : av > bv ? -1 : 0);
    });

    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No alerts yet — click Re-scan above</td></tr>`;
      return;
    }

    tbody.innerHTML = sorted.map(a => {
      const conf   = (a.confidence || 0) * 100;
      const cls    = conf >= 80 ? 'high' : conf >= 50 ? 'med' : 'low';
      const color  = conf >= 80 ? 'var(--risk-high)' : conf >= 50 ? 'var(--risk-med)' : 'var(--risk-low)';
      const typeLabel = { coinjoin_like: 'CoinJoin', peeling_chain: 'Peeling-chain' }[a.type] || a.type;
      const typePill  = { coinjoin_like: 'pill-type-coinjoin', peeling_chain: 'pill-type-peeling' }[a.type] || 'pill-blue';

      const sentence = _evidenceSentence(a);
      const txidShort = a.txid ? a.txid.substring(0, 14) + '…' : '—';
      const ago = a.updated_at ? _timeAgo(a.updated_at) : '—';

      const labelInside = conf >= 50
        ? `<span class="conf-bar-fill-label">${conf.toFixed(0)}%</span>`
        : '';
      const labelOutside = conf < 50
        ? `<span class="conf-pct-outside" style="color:${color}">${conf.toFixed(0)}%</span>`
        : '';

      return `<tr class="clickable" onclick="Alerts.openInGraph('${esc(a.txid)}')">
        <td class="mono-id" style="max-width:130px" title="${esc(a.txid)}">${esc(txidShort)}</td>
        <td><span class="pill ${typePill}">${esc(typeLabel)}</span></td>
        <td>
          <div class="conf-bar-wrap">
            <div class="conf-bar"><div class="conf-bar-fill ${cls}" style="width:${conf}%">${labelInside}</div></div>
            ${labelOutside}
          </div>
        </td>
        <td class="evidence-cell" title="${esc(sentence)}">${esc(sentence)}</td>
        <td class="text-muted">${esc(ago)}</td>
        <td>
          <button class="btn-open-graph" onclick="event.stopPropagation(); Alerts.openInGraph('${esc(a.txid)}')">→ Graph</button>
        </td>
      </tr>`;
    }).join('');

    document.querySelectorAll('#alerts-table th[data-sort]').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.dataset.sort === _sortKey) th.classList.add('sorted-' + _sortDir);
    });
  }

  function _evidenceSentence(a) {
    const ev = a.evidence || {};
    if (a.type === 'coinjoin_like') {
      const outs = ev.output_amounts_sats || [];
      const inCount = ev.input_count ?? '?';
      const outCount = ev.output_count ?? outs.length;
      if (outs.length) {
        const avgBtc = (outs.reduce((s, v) => s + v, 0) / outs.length / 1e8).toFixed(4);
        return `${outCount} roughly-equal outputs of ~${avgBtc} BTC from ${inCount} inputs → classic CoinJoin fan-out`;
      }
      return `${outCount} outputs from ${inCount} inputs, value-clustered`;
    }
    if (a.type === 'peeling_chain') {
      const seq = ev.value_sequence_sats || [];
      const hops = ev.path ? ev.path.length : seq.length;
      if (seq.length >= 2) {
        const first = (seq[0] / 1e8).toFixed(4);
        const last  = (seq[seq.length - 1] / 1e8).toFixed(4);
        return `${hops}-hop chain, value decreasing ${first} → ${last} BTC`;
      }
      return `${hops}-hop peeling chain`;
    }
    return '—';
  }

  function _renderStatusBar() {
    const cj = _allAlerts.filter(a => a.type === 'coinjoin_like').length;
    const pl = _allAlerts.filter(a => a.type === 'peeling_chain').length;
    document.getElementById('status-coinjoin-count').textContent = cj;
    document.getElementById('status-peeling-count').textContent = pl;
    const last = State.getLastScanTime();
    document.getElementById('status-last-scan').textContent = last ? _timeAgo(last.toISOString()) : 'never';
  }

  function openInGraph(txid) {
    if (!txid) return;
    Graph.centerOn(txid, 'Transaction');
  }

  function setFilter(type) {
    _typeFilter = type;
    document.querySelectorAll('.alert-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.type === type);
    });
    load();
  }

  function setSort(key) {
    if (_sortKey === key) {
      _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      _sortKey = key;
      _sortDir = 'desc';
    }
    _render();
  }

  async function rescan() {
    const btn = document.getElementById('rescan-btn');
    if (btn) btn.classList.add('spinning');
    Utils.toast('Re-scanning…', 'info');
    try {
      await Promise.all([
        API.detectCoinjoinWrite(State.getCase(), 0.5),
        API.detectPeelingWrite(State.getCase(), 0.5),
      ]);
      State.setLastScanTime(new Date());
      await load();
      Utils.toast('Re-scan complete', 'ok');
    } catch (e) {
      Utils.toast(e.message, 'error');
    } finally {
      if (btn) btn.classList.remove('spinning');
    }
  }

  function _timeAgo(iso) {
    if (!iso || iso === 'None') return '—';
    try {
      const d = new Date(iso.replace(/\[.*\]/, ''));
      const diff = (Date.now() - d) / 1000;
      if (diff < 60)   return 'just now';
      if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
      return `${Math.round(diff / 86400)}d ago`;
    } catch { return '—'; }
  }

  function esc(v) {
    return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  return { load, setFilter, setSort, openInGraph, rescan };
})();