/* ─── Bitcoin Forensics — app.js ──────────────────────────────
   Vanilla JS. All API calls go through apiFetch().
   State is kept simple: selectedFile, activeTab.
──────────────────────────────────────────────────────────────── */

const API = '';   // same origin — empty prefix

let selectedFile  = null;
let activeTab     = 'ingest';
let toastTimer    = null;

// ── Utilities ────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast--${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function setLoading(btnId, loading, label = null) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (label) btn.textContent = loading ? '⏳ ' + label : label;
}

// ── Tab switching ─────────────────────────────────────────────

function switchTab(tab) {
  ['ingest', 'detect', 'stats'].forEach(t => {
    document.getElementById(`panel-${t}`).classList.toggle('hidden', t !== tab);
    document.getElementById(`tab-${t}`).classList.toggle('tab--active', t === tab);
    document.getElementById(`tab-${t}`).setAttribute('aria-selected', t === tab);
  });
  activeTab = tab;
  if (tab === 'stats') loadStats();
}

// ── Case selector ─────────────────────────────────────────────

function getCase() {
  return document.getElementById('global-case-select').value || 'CASE_2026_001';
}

async function loadCases() {
  try {
    const data = await apiFetch('/cases');
    const sel = document.getElementById('global-case-select');
    sel.innerHTML = data.cases.map(c => `<option value="${c}">${c}</option>`).join('');
  } catch {
    document.getElementById('global-case-select').innerHTML =
      '<option value="CASE_2026_001">CASE_2026_001</option>';
  }
}

// ── Health check ──────────────────────────────────────────────

async function checkHealth() {
  const badge = document.getElementById('health-badge');
  const text  = document.getElementById('health-text');
  try {
    const data = await apiFetch('/health');
    if (data.status === 'ok') {
      badge.className = 'badge badge--ok';
      text.textContent = 'Neo4j Connected';
    } else throw new Error();
  } catch {
    badge.className = 'badge badge--error';
    text.textContent = 'Neo4j Unreachable';
  }
}

// ── Server file list ──────────────────────────────────────────

async function loadServerFiles() {
  const container = document.getElementById('server-files');
  try {
    const data = await apiFetch('/ingest/files');
    if (!data.files || data.files.length === 0) {
      container.innerHTML = '<p class="muted">No transaction files found in DATA_DIR.</p>';
      return;
    }
    container.innerHTML = data.files.map(f => `
      <div class="file-item">
        <span class="file-name">📄 ${esc(f.name)}</span>
        <span class="file-meta">
          <span class="file-format">${esc(f.format)}</span>
          ${formatBytes(f.size_bytes)}
        </span>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p class="muted" style="color:var(--red)">${esc(err.message)}</p>`;
  }
}

// ── File upload (drop zone) ───────────────────────────────────

function handleFileSelect(input) {
  if (!input.files.length) return;
  selectedFile = input.files[0];
  const display = document.getElementById('selected-file');
  display.textContent = `📎 ${selectedFile.name}  (${formatBytes(selectedFile.size)})`;
  display.classList.remove('hidden');
  document.getElementById('upload-btn').disabled = false;
}

// Drag-and-drop
(function initDrop() {
  const zone = document.getElementById('drop-zone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    selectedFile = file;
    const display = document.getElementById('selected-file');
    display.textContent = `📎 ${file.name}  (${formatBytes(file.size)})`;
    display.classList.remove('hidden');
    document.getElementById('upload-btn').disabled = false;
  });
})();

// ── Upload file ───────────────────────────────────────────────

async function uploadFile() {
  if (!selectedFile) return;
  const btn = document.getElementById('upload-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Ingesting…';

  const form = new FormData();
  form.append('file', selectedFile);
  form.append('case_id', getCase());

  try {
    const data = await apiFetch('/ingest/upload', { method: 'POST', body: form });
    toast(`Ingested ${data.file}: ${data.accepted_count} accepted`, 'ok');
    renderIngestReport(`Upload: ${data.file}`, [data]);
    loadCases();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ingest File';
  }
}

// ── Run all ───────────────────────────────────────────────────

async function runAll() {
  try {
    toast('Running pipeline…', 'info');
    const data = await apiFetch(`/ingest/run-all?case_id=${encodeURIComponent(getCase())}`, {
      method: 'POST',
    });
    toast(`Done! ${data.reports.reduce((s, r) => s + r.accepted_count, 0)} tx accepted`, 'ok');
    renderRunAllReport(data);
    loadCases();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Render ingest report ──────────────────────────────────────

function renderIngestReport(title, reports) {
  const result = document.getElementById('ingest-result');
  const tbody  = document.getElementById('ingest-tbody');
  const titleEl = document.getElementById('ingest-result-title');
  const badges   = document.getElementById('ingest-summary-badges');

  let totalAcc = 0, totalInv = 0, totalDup = 0, rows = [];

  reports.forEach(r => {
    totalAcc += r.accepted_count;
    totalInv += r.rejected_invalid_count;
    totalDup += r.rejected_duplicate_count;
    if (r.results) {
      r.results.forEach(row => rows.push({ ...row, file: r.file || '' }));
    }
  });

  titleEl.textContent = title;
  badges.innerHTML = `
    <span class="pill pill--green">✓ ${totalAcc} accepted</span>
    ${totalInv  ? `<span class="pill pill--red">✗ ${totalInv} invalid</span>` : ''}
    ${totalDup  ? `<span class="pill pill--yellow">⚠ ${totalDup} duplicate</span>` : ''}
  `;

  if (rows.length > 0) {
    tbody.innerHTML = rows.map(r => {
      const st = r.status;
      const cls = st === 'accepted' ? 'status-accepted'
                : st === 'rejected_duplicate' ? 'status-duplicate'
                : 'status-rejected';
      const label = st === 'accepted' ? '✓ Accepted'
                  : st === 'rejected_duplicate' ? '⚠ Duplicate'
                  : '✗ Invalid';
      return `
        <tr>
          <td class="mono">${esc(r.row_ref)}</td>
          <td class="mono">${r.txid ? esc(r.txid.substring(0, 16)) + '…' : '—'}</td>
          <td class="${cls}">${label}</td>
          <td style="color:var(--muted)">${r.errors && r.errors.length ? esc(r.errors.join('; ')) : '—'}</td>
        </tr>
      `;
    }).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="4" class="muted" style="text-align:center">No row-level data available</td></tr>';
  }

  result.classList.remove('hidden');
}

function renderRunAllReport(data) {
  const reports = data.reports.map(r => ({ ...r, results: [] }));
  renderIngestReport(
    `Run All — ${data.files_processed} file(s) · Case: ${data.case_id}`,
    reports
  );
}

// ── Detect ────────────────────────────────────────────────────

async function runDetect(writeToDB) {
  const confidence = document.getElementById('detect-confidence').value / 100;
  const caseId     = getCase();
  const endpoint   = writeToDB ? '/detect/coinjoin/write' : '/detect/coinjoin';
  const method     = writeToDB ? 'POST' : 'GET';
  const query      = `?case_id=${encodeURIComponent(caseId)}&min_confidence=${confidence}`;

  document.getElementById('detect-result').classList.add('hidden');
  document.getElementById('detect-empty').classList.add('hidden');
  toast('Running detector…', 'info');

  try {
    const data = await apiFetch(endpoint + query, { method });

    if (writeToDB) {
      toast(data.message, 'ok');
      // refresh with plain scan to show results
      const scan = await apiFetch('/detect/coinjoin' + query);
      renderDetectResult(scan, caseId, confidence);
    } else {
      renderDetectResult(data, caseId, confidence);
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderDetectResult(data, caseId, confidence) {
  const result   = document.getElementById('detect-result');
  const empty    = document.getElementById('detect-empty');
  const titleEl  = document.getElementById('detect-result-title');
  const tbody    = document.getElementById('detect-tbody');

  if (!data.alerts || data.alerts.length === 0) {
    empty.classList.remove('hidden');
    result.classList.add('hidden');
    return;
  }

  titleEl.textContent =
    `${data.alert_count} CoinJoin Alert(s) — Case: ${caseId}  |  Min confidence: ${Math.round(confidence * 100)}%`;

  tbody.innerHTML = data.alerts.map(a => {
    const pct = Math.round(a.confidence * 100);
    const amts = a.output_amounts_btc.slice(0, 5).map(v => v.toFixed(4)).join(', ')
               + (a.output_amounts_btc.length > 5 ? ', …' : '');
    return `
      <tr>
        <td class="mono">${esc(a.alert_id.substring(0, 28))}…</td>
        <td class="mono">${esc(a.txid.substring(0, 14))}…</td>
        <td>
          <div class="conf-bar-wrap">
            <div class="conf-bar"><div class="conf-bar-fill" style="width:${pct}%"></div></div>
            <span style="font-weight:700;color:var(--accent)">${pct}%</span>
          </div>
        </td>
        <td>${a.input_count}</td>
        <td>${a.output_count}</td>
        <td class="mono" style="font-size:.75rem">${esc(amts)}</td>
      </tr>
    `;
  }).join('');

  result.classList.remove('hidden');
  empty.classList.add('hidden');
}

// ── Stats ─────────────────────────────────────────────────────

async function loadStats() {
  const caseId = getCase();
  document.getElementById('stat-case-id').textContent = caseId;
  ['stat-tx', 'stat-addr', 'stat-alerts'].forEach(id => {
    document.getElementById(id).textContent = '…';
  });
  try {
    const data = await apiFetch(`/stats?case_id=${encodeURIComponent(caseId)}`);
    document.getElementById('stat-tx').textContent     = data.transactions.toLocaleString();
    document.getElementById('stat-addr').textContent   = data.addresses.toLocaleString();
    document.getElementById('stat-alerts').textContent = data.alerts.toLocaleString();
  } catch (err) {
    ['stat-tx', 'stat-addr', 'stat-alerts'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    toast(err.message, 'error');
  }
}

// ── XSS-safe escaping ─────────────────────────────────────────

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────

(async function init() {
  await checkHealth();
  await loadCases();
  await loadServerFiles();
})();
