/* dashboard.js — KPI strip + four Chart.js charts + shared Ingest module */

const Dashboard = (() => {

  const PALETTE = {
    accent:   '#3B7DFF',
    accentBg: 'rgba(59,125,255,.08)',
    grid:     '#E2E5EE',
    muted:    '#6C7688',
    high:     '#E5484D',
    med:      '#F5A623',
    low:      '#30A46C',
    geo: ['#3B7DFF','#0A0F1C','#7CA8FF','#F5A623','#30A46C','#E5484D','#8B98AC','#E2E5EE'],
  };

  function _chartDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: PALETTE_TOOLTIP_BG,
          borderColor: '#E2E5EE',
          borderWidth: 1,
          titleColor: '#E0E6F0',
          bodyColor: '#E0E6F0',
          titleFont: { family: 'Geist', size: 11 },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          padding: 8,
        },
      },
      scales: {
        x: {
          grid: { color: PALETTE.grid, lineWidth: 0.5 },
          ticks: { color: PALETTE.muted, font: { family: 'Geist', size: 10 } },
        },
        y: {
          grid: { color: PALETTE.grid, lineWidth: 0.5 },
          ticks: { color: PALETTE.muted, font: { family: 'Geist', size: 10 } },
          beginAtZero: true,
        },
      },
    };
  }
  const PALETTE_TOOLTIP_BG = '#101827';

  function _makeChart(canvasId, config) {
    State.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const inst = new Chart(ctx, config);
    State.setChart(canvasId, inst);
    return inst;
  }

  function _renderKPIs(data) {
    const defs = [
      { id: 'kpi-tx',     val: data.transactions,      cls: '',          sub: `Case: ${data.case_id}`,  onclick: '' },
      { id: 'kpi-alert',  val: data.alerts,            cls: data.alerts > 0 ? 'risk-high' : '', sub: `${data.high_risk_alerts} high-risk`, onclick: "Nav.go('alerts')" },
      { id: 'kpi-addr',   val: data.addresses,         cls: '',          sub: 'Unique in graph', onclick: '' },
      { id: 'kpi-model',  val: '2',                    cls: '',          sub: 'CoinJoin · Peeling-chain', onclick: '' },
    ];
    defs.forEach(d => {
      const card = document.getElementById(d.id);
      if (!card) return;
      card.querySelector('.kpi-value').textContent = (d.val ?? '—').toLocaleString();
      card.querySelector('.kpi-value').className = `kpi-value ${d.cls}`;
      card.querySelector('.kpi-sub').textContent  = d.sub;
      if (d.onclick) card.setAttribute('onclick', d.onclick);
    });
  }

  async function _renderTimeline(cid) {
    try {
      const { timeline } = await API.timeline(cid);
      const labels = timeline.map(r => r.date);
      const values = timeline.map(r => r.count);
      _makeChart('chart-timeline', {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: values,
            borderColor: PALETTE.accent,
            backgroundColor: PALETTE.accentBg,
            fill: true,
            tension: 0.35,
            pointRadius: values.length < 20 ? 3 : 0,
            pointBackgroundColor: PALETTE.accent,
            borderWidth: 2,
          }],
        },
        options: {
          ..._chartDefaults(),
          plugins: {
            ..._chartDefaults().plugins,
            tooltip: { ..._chartDefaults().plugins.tooltip, callbacks: { label: ctx => `${ctx.parsed.y} tx` } },
          },
        },
      });
    } catch { _chartError('chart-timeline'); }
  }

  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function _renderHighlights(cid) {
    const el = document.getElementById('dash-case-highlights-content');
    if (!el) return;
    try {
      const data = await API.caseHighlights(cid);
      const peel = data.longest_peeling_chain;
      const cj = data.largest_coinjoin;

      if (!peel && !cj) {
        el.innerHTML = '<div class="empty-state-dash">No peeling chain or CoinJoin patterns detected for this case.</div>';
        return;
      }

      let html = '';
      if (peel) {
        html += `
          <div class="forensic-subcard">
            <div class="flex-row" style="justify-content:space-between">
              <span class="pill pill-type-peeling">Longest Peeling Chain</span>
              <span class="metric-stat-box"><strong>${peel.chain_length}</strong> hops (${Math.round((peel.confidence || 0) * 100)}% conf)</span>
            </div>
            <div style="font-size:11px;color:var(--text-muted)">
              Start: <span class="text-mono" style="color:var(--text-primary)">${_esc(peel.start_txid.substring(0, 16))}…</span>
              &nbsp;→&nbsp; End: <span class="text-mono" style="color:var(--text-primary)">${_esc(peel.end_txid.substring(0, 16))}…</span>
            </div>
            <div class="flex-row" style="justify-content:space-between;margin-top:2px">
              <div style="font-size:11px">
                <span class="text-muted">Peeled:</span> <strong style="color:var(--risk-high)">${peel.peeled_off_btc.toFixed(4)} BTC</strong>
                <span class="text-muted" style="margin-left:8px">(${peel.start_balance_btc.toFixed(4)} → ${peel.end_balance_btc.toFixed(4)} BTC)</span>
              </div>
              <button class="btn-open-graph" onclick="Graph.centerOn('${_esc(peel.txid)}','Transaction')">→ Graph</button>
            </div>
          </div>`;
      }

      if (cj) {
        html += `
          <div class="forensic-subcard">
            <div class="flex-row" style="justify-content:space-between">
              <span class="pill pill-type-coinjoin">Largest CoinJoin Structure</span>
              <span class="metric-stat-box"><strong>${cj.input_count} In / ${cj.output_count} Out</strong> (${Math.round((cj.confidence || 0) * 100)}% conf)</span>
            </div>
            <div style="font-size:11px;color:var(--text-muted)">
              TxID: <span class="text-mono" style="color:var(--text-primary)">${_esc(cj.txid.substring(0, 20))}…</span>
            </div>
            <div class="flex-row" style="justify-content:space-between;margin-top:2px">
              <div style="font-size:11px">
                <span class="text-muted">Mixing:</span> <strong>${cj.equal_output_count} × ${cj.denomination_btc.toFixed(4)} BTC</strong>
                <span class="text-muted" style="margin-left:8px">Total: <strong>${cj.total_btc.toFixed(4)} BTC</strong></span>
              </div>
              <button class="btn-open-graph" onclick="Graph.centerOn('${_esc(cj.txid)}','Transaction')">→ Graph</button>
            </div>
          </div>`;
      }

      el.innerHTML = html;
    } catch (err) {
      el.innerHTML = `<div class="empty-state-dash">Error loading highlights: ${_esc(err.message)}</div>`;
    }
  }

  async function _renderRiskExposure(cid) {
    const el = document.getElementById('dash-risk-exposure-content');
    if (!el) return;
    try {
      const data = await API.riskExposure(cid);
      const seeds = data.seeds || [];
      if (!seeds.length) {
        el.innerHTML = '<div class="empty-state-dash">No high-risk seed addresses associated with this case.</div>';
        return;
      }

      let html = `
        <div class="table-wrap" style="max-height:220px;overflow-y:auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Seed Entity / Address</th>
                <th>Risk</th>
                <th>Direct In / Out</th>
                <th>Reach (1 / 2 / 3 Hops)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
      `;
      seeds.forEach(s => {
        const riskPct = Math.round((s.risk_score || 0) * 100);
        const riskClass = riskPct >= 70 ? 'pill-invalid' : riskPct >= 40 ? 'pill-duplicate' : 'pill-accepted';
        html += `
          <tr>
            <td>
              <div style="font-weight:700;font-size:11px">${_esc(s.entity_name)}</div>
              <div class="text-mono text-muted" style="font-size:10px" title="${_esc(s.address)}">${_esc(s.address.substring(0, 16))}…</div>
            </td>
            <td><span class="pill ${riskClass}">${riskPct}%</span></td>
            <td>
              <div style="font-size:11px">
                <span style="color:var(--risk-low)">↓ ${s.direct_in_btc.toFixed(4)}</span> / 
                <span style="color:var(--risk-high)">↑ ${s.direct_out_btc.toFixed(4)}</span> BTC
              </div>
            </td>
            <td>
              <div class="hop-group">
                <span class="hop-badge" title="Distinct addresses within 1 hop">1h: ${s.hop1_addrs}</span>
                <span class="hop-badge" title="Distinct addresses within 2 hops">2h: ${s.hop2_addrs}</span>
                <span class="hop-badge" title="Distinct addresses within 3 hops">3h: ${s.hop3_addrs}</span>
              </div>
            </td>
            <td>
              <button class="btn-open-graph" onclick="Graph.centerOn('${_esc(s.address)}','Address')">→ Graph</button>
            </td>
          </tr>
        `;
      });
      html += `</tbody></table></div>`;
      el.innerHTML = html;
    } catch (err) {
      el.innerHTML = `<div class="empty-state-dash">Error loading risk exposure: ${_esc(err.message)}</div>`;
    }
  }

  async function _renderStructuralFlags(cid) {
    const el = document.getElementById('dash-structural-flags-content');
    if (!el) return;
    try {
      const data = await API.structuralFlags(cid);
      const bursts = data.burst_senders || [];
      const totalReused = (data.address_reuse && data.address_reuse.total_reused_addresses) || 0;

      let html = `
        <div class="metric-stat-box" style="margin-bottom:10px;width:100%;justify-content:space-between">
          <span>Pass-Through Address Role Reuse:</span>
          <strong>${totalReused.toLocaleString()} addresses reused across roles</strong>
        </div>
      `;

      if (!bursts.length) {
        html += '<div class="empty-state-dash" style="padding:16px 0">No high-frequency burst senders (≥4 spends/hr) detected.</div>';
      } else {
        html += `
          <div class="table-wrap" style="max-height:165px;overflow-y:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Burst Address</th>
                  <th>Spends (1h)</th>
                  <th>Window</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
        `;
        bursts.forEach(b => {
          const start = b.window_start ? b.window_start.replace('T', ' ').substring(0, 16) : '—';
          html += `
            <tr>
              <td>
                <div class="text-mono" style="font-size:11px" title="${_esc(b.address)}">${_esc(b.address.substring(0, 18))}…</div>
                ${b.entity_name ? `<div style="font-size:10px;color:var(--text-muted)">${_esc(b.entity_name)}</div>` : ''}
              </td>
              <td><span class="pill pill-duplicate">${b.burst_count} spends</span></td>
              <td style="font-size:10.5px;color:var(--text-muted)">${_esc(start)}</td>
              <td>
                <button class="btn-open-graph" onclick="Graph.centerOn('${_esc(b.address)}','Address')">→ Graph</button>
              </td>
            </tr>
          `;
        });
        html += `</tbody></table></div>`;
      }

      el.innerHTML = html;
    } catch (err) {
      el.innerHTML = `<div class="empty-state-dash">Error loading structural flags: ${_esc(err.message)}</div>`;
    }
  }

  async function _renderFeeOutliers(cid) {
    const el = document.getElementById('dash-fee-outliers-content');
    const statEl = document.getElementById('dash-fee-stats');
    if (!el) return;
    try {
      const data = await API.feeOutliers(cid);
      if (statEl) {
        statEl.innerHTML = `
          <span class="metric-stat-box">Mean Fee: <strong>${data.mean_fee_btc.toFixed(6)} BTC</strong></span>
          <span class="metric-stat-box">+2σ Threshold: <strong>${data.high_threshold_btc.toFixed(6)} BTC</strong></span>
        `;
      }

      const high = data.high_outliers || [];
      const zero = data.zero_fee_transactions || [];

      let html = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <!-- Subcol 1: Priority Fee Spikes -->
          <div class="forensic-subcard">
            <div class="flex-row" style="justify-content:space-between">
              <span class="forensic-panel-title" style="font-size:11.5px">Priority Fee Spikes (> +2σ)</span>
              <span class="pill pill-invalid">${high.length} tx</span>
            </div>
      `;

      if (!high.length) {
        html += `<div class="empty-state-dash" style="padding:14px 0">No statistically significant fee spikes found.</div>`;
      } else {
        html += `
          <div class="table-wrap" style="max-height:160px;overflow-y:auto">
            <table class="data-table">
              <thead><tr><th>TxID</th><th>Fee (BTC)</th><th>Score</th><th>Action</th></tr></thead>
              <tbody>
        `;
        high.slice(0, 10).forEach(h => {
          html += `
            <tr>
              <td><span class="text-mono" style="font-size:10.5px" title="${_esc(h.txid)}">${_esc(h.txid.substring(0, 14))}…</span></td>
              <td style="font-weight:700;font-size:11px">${h.fee_btc.toFixed(6)}</td>
              <td><span class="sigma-pill">+${h.sigma_score}σ</span></td>
              <td><button class="btn-open-graph" onclick="Graph.centerOn('${_esc(h.txid)}','Transaction')">→ Graph</button></td>
            </tr>
          `;
        });
        html += `</tbody></table></div>`;
      }

      html += `
          </div>
          <!-- Subcol 2: Zero-Fee Batches -->
          <div class="forensic-subcard">
            <div class="flex-row" style="justify-content:space-between">
              <span class="forensic-panel-title" style="font-size:11.5px">Zero-Fee Transactions</span>
              <span class="pill pill-blue">${zero.length} tx</span>
            </div>
      `;

      if (!zero.length) {
        html += `<div class="empty-state-dash" style="padding:14px 0">No zero-fee transactions in this case.</div>`;
      } else {
        html += `
          <div class="table-wrap" style="max-height:160px;overflow-y:auto">
            <table class="data-table">
              <thead><tr><th>TxID</th><th>Input Volume</th><th>Action</th></tr></thead>
              <tbody>
        `;
        zero.slice(0, 10).forEach(z => {
          html += `
            <tr>
              <td><span class="text-mono" style="font-size:10.5px" title="${_esc(z.txid)}">${_esc(z.txid.substring(0, 14))}…</span></td>
              <td style="font-size:11px">${z.input_btc.toFixed(4)} BTC</td>
              <td><button class="btn-open-graph" onclick="Graph.centerOn('${_esc(z.txid)}','Transaction')">→ Graph</button></td>
            </tr>
          `;
        });
        html += `</tbody></table></div>`;
      }

      html += `
          </div>
        </div>
      `;
      el.innerHTML = html;
    } catch (err) {
      el.innerHTML = `<div class="empty-state-dash">Error loading fee outliers: ${_esc(err.message)}</div>`;
    }
  }

  function _chartError(id) {
    const canvas = document.getElementById(id);
    if (canvas) {
      const p = canvas.parentElement;
      p.innerHTML += '<p class="text-muted" style="font-size:11px;padding:8px 0">No data available</p>';
    }
  }

  async function load() {
    const cid = State.getCase();
    try {
      const stats = await API.stats(cid);
      _renderKPIs(stats);
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
    _renderTimeline(cid);
    _renderHighlights(cid);
    _renderRiskExposure(cid);
    _renderStructuralFlags(cid);
    _renderFeeOutliers(cid);
  }

  return { load };
})();

/* ── Ingest module — scoped by 'dash' / 'alerts' so the two panel
   instances (Dashboard + Alerts) don't collide on element IDs. ── */
const Ingest = (() => {
  const _selected = {}; // scope -> File

  function handleFileSelect(scope, input) {
    if (!input.files.length) return;
    _selected[scope] = input.files[0];
    const display = document.getElementById(`selected-file-${scope}`);
    display.textContent = `📎 ${_selected[scope].name} (${_formatBytes(_selected[scope].size)})`;
    display.classList.remove('hidden');
    document.getElementById(`upload-btn-${scope}`).disabled = false;
  }

  async function upload(scope) {
    const file = _selected[scope];
    if (!file) return;
    const btn = document.getElementById(`upload-btn-${scope}`);
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = '⏳ Ingesting…';
    try {
      const data = await API.ingestUpload(file, State.getCase());
      Utils.toast(`${file.name}: ${data.accepted_count} accepted`, 'ok');
      _renderResult(scope, [data]);
      _refreshCases();
      if (State.getSection() === 'dashboard') Dashboard.load();
      if (State.getSection() === 'alerts') Alerts.load();
    } catch (e) {
      Utils.toast(e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }

  async function runAll(scope) {
    Utils.toast('Ingesting all files…', 'info');
    try {
      const data = await API.ingestRunAll(State.getCase());
      const total = data.reports.reduce((s, r) => s + r.accepted_count, 0);
      Utils.toast(`Done — ${total} transactions loaded`, 'ok');
      _renderResult(scope, data.reports);
      _refreshCases();
      if (State.getSection() === 'dashboard') Dashboard.load();
      if (State.getSection() === 'alerts') Alerts.load();
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  }

  function _renderResult(scope, reports) {
    const tbody = document.getElementById(`ingest-tbody-${scope}`);
    const wrap  = document.getElementById(`ingest-result-${scope}`);
    if (!tbody || !wrap) return;
    tbody.innerHTML = reports.map(r => `
      <tr>
        <td>${r.file || '—'}</td>
        <td><span class="pill pill-accepted">${r.accepted_count}</span></td>
        <td><span class="pill pill-invalid">${r.rejected_invalid_count}</span></td>
        <td><span class="pill pill-duplicate">${r.rejected_duplicate_count}</span></td>
      </tr>`).join('');
    wrap.classList.remove('hidden');
  }

  function _formatBytes(b) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }

  // Drag-and-drop wiring for both scopes, once DOM is ready.
  function _initDropZone(scope) {
    const zone = document.getElementById(`dropzone-${scope}`);
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (!file) return;
      _selected[scope] = file;
      const display = document.getElementById(`selected-file-${scope}`);
      display.textContent = `📎 ${file.name} (${_formatBytes(file.size)})`;
      display.classList.remove('hidden');
      document.getElementById(`upload-btn-${scope}`).disabled = false;
    });
  }

  ['dash', 'alerts'].forEach(_initDropZone);

  return { handleFileSelect, upload, runAll };
})();

/* Shared with the old global — case dropdown refresh, called after ingest */
async function _refreshCases() {
  try {
    const { cases } = await API.cases();
    const sel = document.getElementById('case-select');
    const cur = State.getCase();
    sel.innerHTML = cases.map(c => `<option value="${c}" ${c === cur ? 'selected' : ''}>${c}</option>`).join('');
  } catch { /* keep whatever's there */ }
}