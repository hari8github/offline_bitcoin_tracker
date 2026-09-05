/* api.js — fetch wrappers for every backend endpoint.
   All functions return parsed JSON or throw an Error with a
   human-readable message. Never call fetch() outside this file. */

const API = (() => {
  const BASE = '';   // same-origin

  async function _fetch(path, opts = {}) {
    const res = await fetch(BASE + path, opts);
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    if (!res.ok) {
      throw new Error(body.detail || `HTTP ${res.status} — ${path}`);
    }
    return body;
  }

  return {
    // ── System ─────────────────────────────────────────────
    health:      ()       => _fetch('/health'),
    cases:       ()       => _fetch('/cases'),

    // ── Dashboard ──────────────────────────────────────────
    stats:       (cid)    => _fetch(`/stats?case_id=${enc(cid)}`),
    timeline:    (cid)    => _fetch(`/dashboard/timeline?case_id=${enc(cid)}`),
    topAddrs:    (cid, n) => _fetch(`/dashboard/top-addresses?case_id=${enc(cid)}&limit=${n||10}`),
    geo:         (cid)    => _fetch(`/dashboard/geo?case_id=${enc(cid)}`),

    // ── Graph ──────────────────────────────────────────────
    search:  (q, cid)     => _fetch(`/graph/search?q=${enc(q)}&case_id=${enc(cid)}`),
    subgraph: (nodeId, nodeType, cid) =>
      _fetch(`/graph/subgraph?node_id=${enc(nodeId)}&node_type=${enc(nodeType)}&case_id=${enc(cid)}`),

    // ── Alerts ─────────────────────────────────────────────
    alerts:       (cid, type) => _fetch(`/alerts?case_id=${enc(cid)}` + (type && type !== 'all' ? `&type_filter=${enc(type)}` : '')),

    // ── Detection ──────────────────────────────────────────
    detectCoinjoin:      (cid, conf) => _fetch(`/detect/coinjoin?case_id=${enc(cid)}&min_confidence=${conf}`),
    detectCoinjoinWrite: (cid, conf) => _fetch(`/detect/coinjoin/write?case_id=${enc(cid)}&min_confidence=${conf}`, { method: 'POST' }),
    detectPeeling:       (cid, conf) => _fetch(`/detect/peeling-chain?case_id=${enc(cid)}&min_confidence=${conf}`),
    detectPeelingWrite:  (cid, conf) => _fetch(`/detect/peeling-chain/write?case_id=${enc(cid)}&min_confidence=${conf}`, { method: 'POST' }),

    // ── Ingestion ──────────────────────────────────────────
    ingestFiles: ()               => _fetch('/ingest/files'),
    ingestRunAll: (cid)           => _fetch(`/ingest/run-all?case_id=${enc(cid)}`, { method: 'POST' }),
    ingestUpload: (file, cid)     => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('case_id', cid);
      return _fetch('/ingest/upload', { method: 'POST', body: fd });
    },

    // ── Assistant ──────────────────────────────────────────
    assistantChat: (message, cid) => _fetch('/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, case_id: cid }),
    }),
  };

  function enc(v) { return encodeURIComponent(v ?? ''); }
})();
