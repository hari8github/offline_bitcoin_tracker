/* dashboard.js — KPI strip + four Chart.js charts */

const Dashboard = (() => {

  // ── Chart helpers ──────────────────────────────────────────

  function _chartDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#152238',
          borderColor: '#DCE2ED',
          borderWidth: 1,
          titleColor: '#C8D4E8',
          bodyColor: '#C8D4E8',
          titleFont: { family: 'Inter', size: 11 },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          padding: 8,
        },
      },
      scales: {
        x: {
          grid: { color: '#DCE2ED', lineWidth: 0.5 },
          ticks: { color: '#5B6472', font: { family: 'Inter', size: 10 } },
        },
        y: {
          grid: { color: '#DCE2ED', lineWidth: 0.5 },
          ticks: { color: '#5B6472', font: { family: 'Inter', size: 10 } },
          beginAtZero: true,
        },
      },
    };
  }

  function _makeChart(canvasId, config) {
    State.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const inst = new Chart(ctx, config);
    State.setChart(canvasId, inst);
    return inst;
  }

  // ── KPIs ───────────────────────────────────────────────────

  function _renderKPIs(data) {
    const defs = [
      { id: 'kpi-tx',     label: 'Total Tx',       val: data.transactions,      cls: '',          sub: `Case: ${data.case_id}`,  onclick: '' },
      { id: 'kpi-alert',  label: 'Open Alerts',    val: data.alerts,            cls: data.alerts > 0 ? 'risk-high' : '', sub: `${data.high_risk_alerts} high-risk`, onclick: "Nav.go('alerts')" },
      { id: 'kpi-addr',   label: 'Addresses',      val: data.addresses,         cls: '',          sub: 'Unique in graph', onclick: '' },
      { id: 'kpi-model',  label: 'Detectors',      val: '2',                    cls: '',          sub: 'CoinJoin · Peeling-chain', onclick: '' },
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

  // ── Chart: Transaction volume timeline ─────────────────────

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
            borderColor: '#2E6BE6',
            backgroundColor: 'rgba(46,107,230,.08)',
            fill: true,
            tension: 0.35,
            pointRadius: values.length < 20 ? 3 : 0,
            pointBackgroundColor: '#2E6BE6',
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
    } catch {
      _chartError('chart-timeline');
    }
  }

  // ── Chart: Confidence distribution of alerts ───────────────

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
            backgroundColor: ['#DCE2ED', '#B8860B', '#2E6BE6', '#C0392B'],
            borderRadius: 3,
            borderWidth: 0,
          }],
        },
        options: {
          ..._chartDefaults(),
          plugins: { ..._chartDefaults().plugins, tooltip: { ..._chartDefaults().plugins.tooltip, callbacks: { label: ctx => `${ctx.parsed.y} alerts` } } },
        },
      });
    } catch {
      _chartError('chart-conf');
    }
  }

  // ── Chart: Top addresses by received value ─────────────────

  async function _renderTopAddrs(cid) {
    try {
      const { addresses } = await API.topAddrs(cid, 8);
      _makeChart('chart-addrs', {
        type: 'bar',
        data: {
          labels: addresses.map(a => a.address ? a.address.substring(0, 10) + '…' : '?'),
          datasets: [{
            data: addresses.map(a => a.total_btc),
            backgroundColor: '#2E6BE6',
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
    } catch {
      _chartError('chart-addrs');
    }
  }

  // ── Chart: Geo / country distribution ─────────────────────

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
            backgroundColor: [
              '#2E6BE6','#152238','#5B9EF0','#B8860B','#2E8B57',
              '#C0392B','#7F8FA4','#DCE2ED',
            ],
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
              labels: { font: { family: 'Inter', size: 10 }, color: '#5B6472', boxWidth: 10, padding: 8 },
            },
            tooltip: { ..._chartDefaults().plugins.tooltip, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} tx` } },
          },
        },
      });
    } catch {
      _chartError('chart-geo');
    }
  }

  function _chartError(id) {
    const canvas = document.getElementById(id);
    if (canvas) {
      const p = canvas.parentElement;
      p.innerHTML += '<p class="text-muted" style="font-size:11px;padding:8px 0">No data available</p>';
    }
  }

  // ── Public: load ──────────────────────────────────────────

  async function load() {
    const cid = State.getCase();
    try {
      const stats = await API.stats(cid);
      _renderKPIs(stats);
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
    // Charts run in parallel — one failing doesn't block others
    _renderTimeline(cid);
    _renderConfDist(cid);
    _renderTopAddrs(cid);
    _renderGeo(cid);
  }

  return { load };
})();
