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

  async function _renderConfDist(cid) {
    try {
      const { alerts } = await API.alerts(cid);
      const buckets = { '0–40%': 0, '40–60%': 0, '60–80%': 0, '80–100%': 0 };
      alerts.forEach(a => {
        const c = (a.confidence || 0) * 100;
        if (c < 40) buckets['0–40%']++;
        else if (c < 60) buckets['40–60%']++;
        else if (c < 80) buckets['60–80%']++;
        else buckets['80–100%']++;
      });
      _makeChart('chart-conf', {
        type: 'bar',
        data: {
          labels: Object.keys(buckets),
          datasets: [{
            data: Object.values(buckets),
            backgroundColor: [PALETTE.grid, PALETTE.med, PALETTE.accent, PALETTE.high],
            borderRadius: 3,
            borderWidth: 0,
          }],
        },
        options: {
          ..._chartDefaults(),
          plugins: { ..._chartDefaults().plugins, tooltip: { ..._chartDefaults().plugins.tooltip, callbacks: { label: ctx => `${ctx.parsed.y} alerts` } } },
        },
      });
    } catch { _chartError('chart-conf'); }
  }

  async function _renderTopAddrs(cid) {
    try {
      const { addresses } = await API.topAddrs(cid, 8);
      _makeChart('chart-addrs', {
        type: 'bar',
        data: {
          labels: addresses.map(a => a.address ? a.address.substring(0, 10) + '…' : '?'),
          datasets: [{
            data: addresses.map(a => a.total_btc),
            backgroundColor: PALETTE.accent,
            borderRadius: 3,
            borderWidth: 0,
          }],
        },
        options: {
          ..._chartDefaults(),
          indexAxis: 'y',
          plugins: { ..._chartDefaults().plugins, tooltip: { ..._chartDefaults().plugins.tooltip, callbacks: { label: ctx => `${ctx.parsed.x.toFixed(4)} BTC` } } },
        },
      });
    } catch { _chartError('chart-addrs'); }
  }

  async function _renderGeo(cid) {
    try {
      const { geo } = await API.geo(cid);
      const top = geo.slice(0, 8);
      _makeChart('chart-geo', {
        type: 'doughnut',
        data: {
          labels: top.map(g => g.country),
          datasets: [{
            data: top.map(g => g.count),
            backgroundColor: PALETTE.geo,
            borderWidth: 1,
            borderColor: '#FFFFFF',
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true, position: 'right',
              labels: { font: { family: 'Geist', size: 10 }, color: PALETTE.muted, boxWidth: 10, padding: 8 },
            },
            tooltip: { ..._chartDefaults().plugins.tooltip, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} tx` } },
          },
        },
      });
    } catch { _chartError('chart-geo'); }
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
    _renderConfDist(cid);
    _renderTopAddrs(cid);
    _renderGeo(cid);
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