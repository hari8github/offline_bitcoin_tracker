/* alerts.js — alert table, filter chips, detector run buttons */

const Alerts = (() => {
  let _sortKey  = 'confidence';
  let _sortDir  = 'desc';
  let _typeFilter = 'all';
  let _allAlerts  = [];

  // ── Load ──────────────────────────────────────────────────

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
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--risk-high)">${esc(e.message)}</td></tr>`;
      Utils.toast(e.message, 'error');
    }
  }

  function _render() {
    const tbody  = document.getElementById('alerts-tbody');
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
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No alerts yet — run a detector above</td></tr>`;
      return;
    }

    tbody.innerHTML = sorted.map(a => {
      const conf   = (a.confidence || 0) * 100;
      const cls    = conf >= 80 ? 'high' : conf >= 50 ? 'med' : 'low';
      const color  = conf >= 80 ? 'var(--risk-high)' : conf >= 50 ? 'var(--risk-med)' : 'var(--risk-low)';
      const typeLabel = {
        coinjoin_like: 'CoinJoin-like',
        peeling_chain: 'Peeling-chain',
      }[a.type] || a.type;

      const ev = a.evidence || {};
      const evStr = a.type === 'coinjoin_like'
        ? `${ev.input_count || '?'} in / ${ev.output_count || '?'} out`
        : a.type === 'peeling_chain'
          ? `${(ev.path || []).length} hops`
          : '—';

      const txidShort = a.txid ? a.txid.substring(0, 14) + '…' : '—';
      const ago = a.updated_at ? _timeAgo(a.updated_at) : '—';

      return `<tr class="clickable" onclick="Alerts.openInGraph('${esc(a.txid)}')">
        <td class="mono-id" style="max-width:130px" title="${esc(a.txid)}">${esc(txidShort)}</td>
        <td><span class="pill pill-blue">${esc(typeLabel)}</span></td>
        <td>
          <div class="conf-bar-wrap">
            <div class="conf-bar"><div class="conf-bar-fill ${cls}" style="width:${conf}%"></div></div>
            <span class="conf-pct" style="color:${color}">${conf.toFixed(0)}%</span>
          </div>
        </td>
        <td class="text-muted">${esc(evStr)}</td>
        <td class="text-muted">${esc(ago)}</td>
        <td>
          <button class="btn-open-graph" onclick="event.stopPropagation(); Alerts.openInGraph('${esc(a.txid)}')">
            → Graph
          </button>
        </td>
      </tr>`;
    }).join('');

    // Update sort indicators
    document.querySelectorAll('#alerts-table th[data-sort]').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.dataset.sort === _sortKey) th.classList.add('sorted-' + _sortDir);
    });
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

  // ── Detectors ─────────────────────────────────────────────

  async function runDetector(type) {
    const btnId = `det-btn-${type}`;
    const btn   = document.getElementById(btnId);
    if (btn) btn.classList.add('running');
    Utils.toast(`Running ${type} detector…`, 'info');

    try {
      let data;
      if (type === 'coinjoin') {
        data = await API.detectCoinjoinWrite(State.getCase(), 0.5);
      } else if (type === 'peeling') {
        data = await API.detectPeelingWrite(State.getCase(), 0.5);
      }
      Utils.toast(data.message || `Done: ${data.alerts_written} alert(s)`, 'ok');
      load();
    } catch (e) {
      Utils.toast(e.message, 'error');
    } finally {
      if (btn) btn.classList.remove('running');
    }
  }

  // ── Helpers ───────────────────────────────────────────────

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

  return { load, setFilter, setSort, openInGraph, runDetector };
})();
