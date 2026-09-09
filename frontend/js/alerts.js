/* alerts.js — alert table, status bar, evidence fields, clustering, triage sorting */

const Alerts = (() => {
  let _sortKey = 'risk_adj'; // primary sort: risk-adjacency, secondary: confidence desc
  let _sortDir = 'desc';
  let _typeFilter = 'all';    // 'all', 'coinjoin_like', 'peeling_chain', 'risk'
  let _allAlerts = [];
  const _expandedClusters = new Set();

  async function load() {
    const tbody = document.getElementById('alerts-tbody');
    const countEl = document.getElementById('alerts-count');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Loading…</td></tr>`;

    try {
      const data = await API.alerts(State.getCase());
      _allAlerts = data.alerts || [];
      if (countEl) countEl.textContent = `${_allAlerts.length} total`;
      _render();
      _renderStatusBar();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="color:var(--risk-high)">${esc(e.message)}</td></tr>`;
      Utils.toast(e.message, 'error');
    }
  }

  function _getFilteredAlerts() {
    if (_typeFilter === 'all') return [..._allAlerts];
    if (_typeFilter === 'risk') {
      return _allAlerts.filter(a => a.risk_hits && a.risk_hits.length > 0);
    }
    return _allAlerts.filter(a => a.type === _typeFilter);
  }

  function _sortAlerts(items) {
    return [...items].sort((a, b) => {
      if (_sortKey === 'risk_adj') {
        const aRisk = (a.risk_hits && a.risk_hits.length > 0) ? 1 : 0;
        const bRisk = (b.risk_hits && b.risk_hits.length > 0) ? 1 : 0;
        if (aRisk !== bRisk) {
          return _sortDir === 'asc' ? (aRisk - bRisk) : (bRisk - aRisk);
        }
        // Secondary sort: confidence descending
        return (b.confidence || 0) - (a.confidence || 0);
      }

      if (_sortKey === 'confidence' || _sortKey === 'total_btc') {
        const av = a[_sortKey] || 0;
        const bv = b[_sortKey] || 0;
        return _sortDir === 'asc' ? (av - bv) : (bv - av);
      }

      let av = a[_sortKey], bv = b[_sortKey];
      if (av == null) av = '';
      if (bv == null) bv = '';
      return _sortDir === 'asc'
        ? (av > bv ? 1 : av < bv ? -1 : 0)
        : (av < bv ? 1 : av > bv ? -1 : 0);
    });
  }

  function _getClusterKey(a) {
    const conf5 = Math.round((a.confidence || 0) * 20) * 5; // rounded to nearest 5%
    const ev = a.evidence || {};
    let shape = '';
    if (a.type === 'coinjoin_like') {
      const inc = ev.input_count ?? '?';
      const outc = ev.output_count ?? (ev.output_amounts_sats ? ev.output_amounts_sats.length : '?');
      const denom = ev.output_amounts_sats && ev.output_amounts_sats.length ? ev.output_amounts_sats[0] : '?';
      shape = `cj_${inc}_${outc}_${denom}`;
    } else if (a.type === 'peeling_chain') {
      const hops = (ev.path || ev.value_sequence_sats || a.flagged_txids || []).length;
      shape = `peel_${hops}hops`;
    } else {
      shape = 'other';
    }
    return `${a.type}::${conf5}::${shape}`;
  }

  function _render() {
    const tbody = document.getElementById('alerts-tbody');
    const countEl = document.getElementById('alerts-count');
    if (!tbody) return;

    const filtered = _getFilteredAlerts();
    const sorted = _sortAlerts(filtered);

    if (countEl) {
      countEl.textContent = _typeFilter === 'all'
        ? `${_allAlerts.length} total`
        : `${sorted.length} of ${_allAlerts.length}`;
    }

    if (!_allAlerts.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No alerts yet for this case — click Re-scan above or ingest transactions</td></tr>`;
      return;
    }

    if (!sorted.length) {
      const filterDesc = _typeFilter === 'risk' ? 'touching known risk seeds' : `with type "${_typeFilter}"`;
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No alerts ${filterDesc} in this case.</td></tr>`;
      return;
    }

    // Map into clusters
    const clusterMap = new Map();
    sorted.forEach(a => {
      const k = _getClusterKey(a);
      if (!clusterMap.has(k)) clusterMap.set(k, []);
      clusterMap.get(k).push(a);
    });

    const renderedClusters = new Set();
    let rowsHtml = '';

    sorted.forEach(a => {
      const cKey = _getClusterKey(a);
      const cluster = clusterMap.get(cKey) || [];

      if (cluster.length >= 2) {
        // Multi-alert cluster
        if (!renderedClusters.has(cKey)) {
          renderedClusters.add(cKey);
          const isExpanded = _expandedClusters.has(cKey);
          const typeLabel = { coinjoin_like: 'CoinJoin', peeling_chain: 'Peeling-chain' }[a.type] || a.type;
          const totalVol = cluster.reduce((sum, item) => sum + (item.total_btc || 0), 0);
          const hasRisk = cluster.some(item => item.risk_hits && item.risk_hits.length > 0);

          rowsHtml += `
            <tr class="cluster-header-row ${isExpanded ? 'expanded' : ''}" onclick="Alerts.toggleCluster('${esc(cKey)}')">
              <td colspan="7" class="cluster-header-cell">
                <span class="cluster-toggle-icon">▶</span>
                <strong>${cluster.length} similar ${esc(typeLabel)} alerts</strong> — possible repeated actor pattern
                <span class="pill pill-blue" style="margin-left:8px">${cluster.length} alerts</span>
                <span class="metric-stat-box" style="margin-left:8px">Cluster Volume: <strong>${totalVol.toFixed(4)} BTC</strong></span>
                ${hasRisk ? '<span class="badge-risk-hit" style="margin-left:8px;margin-top:0">⚠ Touches Known Risk</span>' : ''}
              </td>
            </tr>
          `;

          if (isExpanded) {
            cluster.forEach(item => {
              rowsHtml += _renderAlertRow(item, true);
            });
          }
        }
      } else {
        // Standalone alert row
        rowsHtml += _renderAlertRow(a, false);
      }
    });

    tbody.innerHTML = rowsHtml;

    // Update table header sort arrows
    document.querySelectorAll('#alerts-table th[data-sort]').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.dataset.sort === _sortKey) th.classList.add('sorted-' + _sortDir);
    });
  }

  function _renderAlertRow(a, isChild = false) {
    const conf = (a.confidence || 0) * 100;
    const cls = conf >= 80 ? 'high' : conf >= 50 ? 'med' : 'low';
    const color = conf >= 80 ? 'var(--risk-high)' : conf >= 50 ? 'var(--risk-med)' : 'var(--risk-low)';
    const typeLabel = { coinjoin_like: 'CoinJoin', peeling_chain: 'Peeling-chain' }[a.type] || a.type;
    const typePill = { coinjoin_like: 'pill-type-coinjoin', peeling_chain: 'pill-type-peeling' }[a.type] || 'pill-blue';

    const txidShort = a.txid ? a.txid.substring(0, 14) + '…' : '—';
    const ago = a.updated_at ? _timeAgo(a.updated_at) : '—';
    const totalBtc = a.total_btc != null ? `${a.total_btc.toFixed(4)} BTC` : '—';

    // Hop badge for peeling chains or multi-tx alerts
    const hops = a.flagged_txids && a.flagged_txids.length > 1
      ? `<span class="pill-hops" title="${a.flagged_txids.length} flagged transactions in chain">${a.flagged_txids.length} hops</span>`
      : '';

    const labelInside = conf >= 50 ? `<span class="conf-bar-fill-label">${conf.toFixed(0)}%</span>` : '';
    const labelOutside = conf < 50 ? `<span class="conf-pct-outside" style="color:${color}">${conf.toFixed(0)}%</span>` : '';

    const evidenceHtml = _renderEvidence(a);

    return `
      <tr class="clickable ${isChild ? 'cluster-child-row' : ''}" onclick="Alerts.openInGraph('${esc(a.txid)}')">
        <td class="mono-id" style="max-width:140px" title="${esc(a.txid || '')}">
          ${esc(txidShort)}${hops}
        </td>
        <td><span class="pill ${typePill}">${esc(typeLabel)}</span></td>
        <td>
          <div class="conf-bar-wrap">
            <div class="conf-bar"><div class="conf-bar-fill ${cls}" style="width:${conf}%">${labelInside}</div></div>
            ${labelOutside}
          </div>
        </td>
        <td><span class="mono" style="font-weight:700;font-size:11px">${esc(totalBtc)}</span></td>
        <td class="evidence-cell">${evidenceHtml}</td>
        <td class="text-muted">${esc(ago)}</td>
        <td>
          <button class="btn-open-graph" onclick="event.stopPropagation(); Alerts.openInGraph('${esc(a.txid)}')">→ Graph</button>
        </td>
      </tr>
    `;
  }

  function _renderEvidence(a) {
    const ev = a.evidence || {};
    let fieldsHtml = '';

    if (a.type === 'coinjoin_like') {
      const outs = ev.output_amounts_sats || [];
      const inCount = ev.input_count ?? '?';
      const outCount = ev.output_count ?? outs.length;
      const denomBtc = outs.length ? (outs[0] / 1e8).toFixed(4) : '—';
      const totalBtc = a.total_btc ? a.total_btc.toFixed(4) : '—';

      fieldsHtml = `
        <div class="evidence-field-list">
          <div class="evidence-field">
            <span class="evidence-key">Structure:</span>
            <span class="evidence-val">${inCount} inputs · ${outCount} outputs</span>
          </div>
          <div class="evidence-field">
            <span class="evidence-key">Denom:</span>
            <span class="evidence-val">${denomBtc} BTC (×${outs.length} equal)</span>
          </div>
          <div class="evidence-field">
            <span class="evidence-key">Volume:</span>
            <span class="evidence-val">${totalBtc} BTC moved</span>
          </div>
        </div>
      `;
    } else if (a.type === 'peeling_chain') {
      const seq = ev.value_sequence_sats || [];
      const path = ev.path || a.flagged_txids || [];
      const hops = path.length || seq.length || 0;
      const startBtc = seq.length ? (seq[0] / 1e8).toFixed(4) : '—';
      const endBtc = seq.length ? (seq[seq.length - 1] / 1e8).toFixed(4) : '—';
      const peeledBtc = seq.length >= 2 ? ((seq[0] - seq[seq.length - 1]) / 1e8).toFixed(4) : '—';

      fieldsHtml = `
        <div class="evidence-field-list">
          <div class="evidence-field">
            <span class="evidence-key">Chain:</span>
            <span class="evidence-val">${hops} hops</span>
          </div>
          <div class="evidence-field">
            <span class="evidence-key">Flow:</span>
            <span class="evidence-val">${startBtc} → ${endBtc} BTC</span>
          </div>
          <div class="evidence-field">
            <span class="evidence-key">Peeled:</span>
            <span class="evidence-val" style="color:var(--risk-high)">${peeledBtc} BTC peeled</span>
          </div>
        </div>
      `;
    } else {
      fieldsHtml = `<span class="text-muted">—</span>`;
    }

    // Risk hits badge
    let riskBadge = '';
    if (a.risk_hits && a.risk_hits.length > 0) {
      const firstHit = a.risk_hits[0];
      const riskPct = Math.round((firstHit.risk || 0) * 100);
      const countExtra = a.risk_hits.length > 1 ? ` (+${a.risk_hits.length - 1})` : '';
      riskBadge = `
        <div>
          <span class="badge-risk-hit" title="Touches seed address: ${esc(firstHit.address || '')}">
            ⚠ Touches ${esc(firstHit.entity || 'Known Risk')}${countExtra} · ${riskPct}%
          </span>
        </div>
      `;
    }

    return `${fieldsHtml}${riskBadge}`;
  }

  function _renderStatusBar() {
    const totalCount = _allAlerts.length;
    const riskCount = _allAlerts.filter(a => a.risk_hits && a.risk_hits.length > 0).length;
    const totalBtc = _allAlerts.reduce((sum, a) => sum + (a.total_btc || 0), 0);

    const totalEl = document.getElementById('status-total-alerts');
    const riskEl = document.getElementById('status-risk-count');
    const btcEl = document.getElementById('status-total-btc');

    if (totalEl) totalEl.textContent = totalCount.toLocaleString();
    if (riskEl)  riskEl.textContent = riskCount.toLocaleString();
    if (btcEl)   btcEl.textContent = totalBtc.toFixed(4);

    // Support legacy DOM elements gracefully if present
    const cjEl = document.getElementById('status-coinjoin-count');
    const plEl = document.getElementById('status-peeling-count');
    const lastEl = document.getElementById('status-last-scan');
    if (cjEl) cjEl.textContent = _allAlerts.filter(a => a.type === 'coinjoin_like').length;
    if (plEl) plEl.textContent = _allAlerts.filter(a => a.type === 'peeling_chain').length;
    if (lastEl) lastEl.textContent = State.getLastScanTime() ? _timeAgo(State.getLastScanTime().toISOString()) : 'never';
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
    _render();
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

  function toggleCluster(cKey) {
    if (_expandedClusters.has(cKey)) {
      _expandedClusters.delete(cKey);
    } else {
      _expandedClusters.add(cKey);
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
      if (diff < 60) return 'just now';
      if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
      return `${Math.round(diff / 86400)}d ago`;
    } catch { return '—'; }
  }

  function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { load, setFilter, setSort, toggleCluster, openInGraph, rescan };
})();