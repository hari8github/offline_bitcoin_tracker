/* graph.js — Cytoscape.js init, node styling, evidence panel (table +
   sentence + connected alerts), context menu, expand-hop. */

const Graph = (() => {
  let cy = null;
  let showAlerts = false;
  let _ctxMenuEl = null;

  const STYLE = [
    {
      selector: 'node',
      style: {
        'label': 'data(label)',
        'font-family': 'JetBrains Mono, monospace',
        'font-size': '9px',
        'color': '#FFFFFF',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'ellipsis',
        'text-max-width': '90px',
        'min-zoomed-font-size': 6,
      },
    },
    {
      selector: 'node[type="Transaction"]',
      style: {
        'shape': 'rectangle',
        'background-color': '#101827',
        'border-color': '#3B7DFF',
        'border-width': 1.5,
        'width': 110,
        'height': 36,
      },
    },
    {
      selector: 'node[type="Address"]',
      style: {
        'shape': 'ellipse',
        'background-color': '#3B7DFF',
        'border-color': '#E2E5EE',
        'border-width': 2,
        'width': 72,
        'height': 72,
        'font-size': '8px',
        'text-max-width': '62px',
      },
    },
    { selector: 'node[type="Address"][riskClass="risk-high"]', style: { 'border-color': '#E5484D', 'border-width': 3 } },
    { selector: 'node[type="Address"][riskClass="risk-med"]',  style: { 'border-color': '#F5A623', 'border-width': 3 } },
    { selector: 'node[type="Address"][riskClass="risk-low"]',  style: { 'border-color': '#30A46C', 'border-width': 2 } },
    {
      selector: 'node[type="Alert"]',
      style: {
        'shape': 'triangle',
        'background-color': '#E5484D',
        'border-color': '#FDEBEC',
        'border-width': 1,
        'width': 36,
        'height': 36,
        'label': '⚠',
        'font-size': '14px',
        'color': '#FFFFFF',
      },
    },
    {
      selector: ':selected',
      style: {
        'border-color': '#F5C518',
        'border-width': 3,
        'overlay-color': 'rgba(245,197,24,.08)',
        'overlay-padding': 4,
      },
    },
    {
      selector: 'edge',
      style: {
        'width': 1.5,
        'line-color': '#C7CEDD',
        'target-arrow-color': '#C7CEDD',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.9,
        'curve-style': 'bezier',
        'label': 'data(amountLabel)',
        'font-family': 'JetBrains Mono, monospace',
        'font-size': '8px',
        'color': '#6C7688',
        'text-rotation': 'autorotate',
        'text-background-color': '#F7F8FB',
        'text-background-opacity': 0.8,
        'text-background-padding': '2px',
        'min-zoomed-font-size': 8,
      },
    },
    { selector: 'edge[type="SPENDS"]', style: { 'line-color': '#3B7DFF', 'target-arrow-color': '#3B7DFF' } },
    { selector: 'edge[type="PAYS_TO"]', style: { 'line-color': '#30A46C', 'target-arrow-color': '#30A46C' } },
    {
      selector: 'edge[type="FLAGS"]',
      style: {
        'line-color': '#E5484D',
        'target-arrow-color': '#E5484D',
        'line-style': 'dashed',
        'line-dash-pattern': [5, 3],
        'width': 1,
      },
    },
    { selector: '.faded', style: { 'opacity': 0.25 } },
  ];

  function init() {
    if (cy) { cy.destroy(); cy = null; State.clearGraph(); }

    cy = cytoscape({
      container: document.getElementById('cy'),
      style: STYLE,
      elements: [],
      layout: { name: 'preset' },
      minZoom: 0.1,
      maxZoom: 4,
      wheelSensitivity: 0.3,
    });

    cy.on('tap', 'node', e => {
      const node = e.target;
      _closeCtxMenu();
      cy.elements().removeClass('faded');
      const connected = node.closedNeighborhood();
      cy.elements().not(connected).addClass('faded');
      _openEvidence(node.data());
    });

    cy.on('tap', e => {
      if (e.target === cy) {
        cy.elements().removeClass('faded');
        _closeEvidence();
        _closeCtxMenu();
      }
    });

    cy.on('dblclick', 'node', e => {
      const d = e.target.data();
      expandNode(d.id, d.type);
    });

    cy.on('cxttap', 'node', e => {
      _openCtxMenu(e.target, e.originalEvent);
    });
    cy.on('tap pan zoom', () => _closeCtxMenu());
  }

  async function loadSubgraph(nodeId, nodeType) {
    if (!cy) init();
    State.clearGraph();
    cy.elements().remove();

    const searchInput = document.getElementById('graph-search-input');
    if (searchInput) searchInput.value = nodeId;

    Utils.toast('Loading graph…', 'info');
    try {
      const data = await API.subgraph(nodeId, nodeType, State.getCase());
      _addElements(data);
      _runLayout(true);
      _checkCap(data);
      Utils.toast(`Graph: ${data.nodes.length} nodes, ${data.edges.length} edges`, 'ok');
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  }

  async function expandNode(nodeId, nodeType) {
    if (!cy) return;
    Utils.toast(`Expanding ${nodeId.substring(0, 16)}…`, 'info');
    try {
      const data = await API.subgraph(nodeId, nodeType, State.getCase());
      const addedIds = _addElements(data);
      if (addedIds.nodes.length === 0) {
        Utils.toast('No new neighbours found', 'info');
        return;
      }
      const newNodes = cy.collection(addedIds.nodes.map(id => cy.$id(id)).filter(n => n.length));
      if (newNodes.length > 0) {
        newNodes.layout({
          name: 'dagre', rankDir: 'LR', nodeSep: 50, rankSep: 80,
          fit: false, animate: true, animationDuration: 300,
        }).run();
      }
      _checkCap(data);
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  }

  function _addElements(data) {
    const added = { nodes: [], edges: [] };
    const batch = [];

    (data.nodes || []).forEach(n => {
      if (State.hasGraphNode(n.id)) return;
      State.addGraphNode(n.id, n);
      added.nodes.push(n.id);
      batch.push({
        group: 'nodes',
        data: { id: n.id, label: n.label, type: n.type, riskClass: n.riskClass || '', amountLabel: '', props: n.props || {} },
        classes: n.type.toLowerCase() + (n.riskClass ? ' ' + n.riskClass : ''),
      });
    });

    (data.edges || []).forEach(e => {
      if (State.hasGraphEdge(e.id)) return;
      State.addGraphEdge(e.id, e);
      added.edges.push(e.id);
      const amtBtc = e.amount_btc;
      batch.push({
        group: 'edges',
        data: { id: e.id, source: e.source, target: e.target, type: e.type, amount_btc: amtBtc, amountLabel: amtBtc != null ? amtBtc.toFixed(4) + ' ₿' : '' },
      });
    });

    if (batch.length > 0) cy.add(batch);
    return added;
  }

  function _runLayout(fit = true) {
    const layout = cy.elements().length > 1
      ? cy.layout({ name: 'dagre', rankDir: 'LR', nodeSep: 55, rankSep: 100, padding: 30, fit, animate: true, animationDuration: 400 })
      : cy.layout({ name: 'preset', fit });
    layout.run();
    const ph = document.getElementById('graph-placeholder');
    if (ph) ph.style.display = cy.elements().length ? 'none' : 'flex';
  }

  function _checkCap(data) {
    const banner = document.getElementById('graph-cap-banner');
    if (!banner) return;
    if (data.capped) {
      banner.textContent = `Showing ${data.cap} of ${data.total_nodes} matching nodes — narrow your filters.`;
      banner.classList.add('visible');
    } else {
      banner.classList.remove('visible');
    }
  }

  function centerOn(nodeId, nodeType) {
    Nav.go('investigate');
    setTimeout(async () => {
      if (!cy || !State.hasGraphNode(nodeId)) {
        await loadSubgraph(nodeId, nodeType || 'Transaction');
      }
      const node = cy.$id(nodeId);
      if (node.length) {
        cy.animate({ center: { eles: node }, zoom: 1.4 }, { duration: 400 });
        node.select();
        _openEvidence(node.data());
      }
    }, 150);
  }

  // ── Evidence panel ────────────────────────────────────────

  function _connectedAlerts(nodeId) {
    if (!cy) return [];
    const n = cy.$id(nodeId);
    if (!n.length) return [];
    return n.neighborhood('node[type="Alert"]').map(a => a.data());
  }

  function _evidenceSentence(type, data, alerts) {
    if (type === 'Transaction') {
      if (!alerts.length) {
        return { text: 'No alerts on this transaction.', cls: 'clean' };
      }
      const parts = alerts.map(a => {
        const p = a.props || {};
        const pct = p.confidence ? `${(parseFloat(p.confidence) * 100).toFixed(0)}%` : '?';
        return `${p.type || 'unknown'} · ${pct} confidence`;
      });
      return { text: `Flagged as ${parts.join('; ')}.`, cls: 'flagged' };
    }
    if (type === 'Address') {
      const risk = data.props?.risk_score;
      if (risk) return { text: `Labeled high-risk (score ${parseFloat(risk).toFixed(2)}) via seed intelligence.`, cls: 'flagged' };
      return { text: 'No risk label on this address.', cls: 'clean' };
    }
    if (type === 'Alert') {
      const p = data.props || {};
      const pct = p.confidence ? `${(parseFloat(p.confidence) * 100).toFixed(1)}%` : '?';
      return { text: `Detected as ${p.type || 'unknown'} with ${pct} confidence.`, cls: 'flagged' };
    }
    return { text: '', cls: '' };
  }

  function _openEvidence(data) {
    Chat.forceClose(); // evidence panel takes priority over the chat drawer
    State.setSelected({ id: data.id, type: data.type, props: data.props });
    const panel = document.getElementById('evidence-panel');
    panel.classList.add('open');

    const typeEl  = document.getElementById('ev-node-type');
    const idEl    = document.getElementById('ev-node-id');
    const bodyEl  = document.getElementById('ev-body');
    const limEl   = document.getElementById('ev-limitations');

    if (typeEl) typeEl.textContent = data.type;
    if (idEl)   idEl.textContent  = data.id;
    if (!bodyEl) return;

    const props = data.props || {};
    const alerts = data.type === 'Transaction' ? _connectedAlerts(data.id) : [];
    const sentence = _evidenceSentence(data.type, data, alerts);

    let html = `<div class="evidence-sentence ${sentence.cls}">${esc(sentence.text)}</div>`;

    if (data.type === 'Transaction') {
      html += _kvTable('Transaction', [
        ['TXID',         _mono(data.id)],
        ['Timestamp',    esc(props.timestamp || '—')],
        ['Source IP',    esc(props.src_ip || '—')],
        ['Dest IP',      esc(props.dst_ip || '—')],
        ['Geo',          esc(props.geo_country || '—')],
        ['ASN',          esc(props.asn || '—')],
        ['Total In',     props.total_input_sats  ? _btcFmt(props.total_input_sats)  : '—'],
        ['Total Out',    props.total_output_sats ? _btcFmt(props.total_output_sats) : '—'],
        ['Implied Fee',  props.implied_fee_sats  ? _btcFmt(props.implied_fee_sats)  : '—'],
        ['Source File',  props.source_file ? esc(`${props.source_file} · ${props.source_row}`) : '—'],
      ]);
      if (alerts.length) {
        html += `<div class="evidence-section-label">Connected Alerts</div>`;
        alerts.forEach(a => {
          const p = a.props || {};
          const pct = p.confidence ? `${(parseFloat(p.confidence) * 100).toFixed(0)}%` : '?';
          html += `<div class="evidence-alert-mini">
            <span>${esc(p.type || 'unknown')}</span>
            <span style="font-weight:700">${pct}</span>
          </div>`;
        });
      }
      html += `<div class="evidence-actions">
        <button class="btn btn-secondary btn-sm" onclick="Graph.expandNode('${esc(data.id)}','Transaction')">⊕ Expand</button>
        <button class="btn btn-secondary btn-sm" onclick="Nav.go('alerts')">→ Open in Alerts</button>
        <button class="btn btn-ghost btn-sm" onclick="Graph.copyId('${esc(data.id)}')">📋 Copy TXID</button>
      </div>`;
    }

    if (data.type === 'Address') {
      html += _kvTable('Address', [
        ['Value',         _mono(data.id)],
        ['Entity',        esc(props.entity_name || '—')],
        ['Type',          esc(props.entity_type || '—')],
        ['Risk Score',    props.risk_score != null ? parseFloat(props.risk_score).toFixed(2) : '—'],
        ['Label Conf.',   props.label_confidence != null ? `${(parseFloat(props.label_confidence) * 100).toFixed(0)}%` : '—'],
        ['Source',        esc(props.source || '—')],
        ['First Flagged', props.first_flagged_txid ? _mono(props.first_flagged_txid.substring(0,16) + '…') : '—'],
      ]);
      html += `<div class="evidence-actions">
        <button class="btn btn-secondary btn-sm" onclick="Graph.expandNode('${esc(data.id)}','Address')">⊕ Expand</button>
        <button class="btn btn-ghost btn-sm" onclick="Graph.copyId('${esc(data.id)}')">📋 Copy Address</button>
      </div>`;
    }

    if (data.type === 'Alert') {
      html += _kvTable('Alert', [
        ['Alert ID',    _mono(data.id)],
        ['Type',        esc(props.type || '—')],
        ['Confidence',  props.confidence ? `${(parseFloat(props.confidence) * 100).toFixed(1)}%` : '—'],
        ['TXID',        props.txid ? _mono(props.txid.substring(0,16) + '…') : '—'],
        ['Updated',     esc(props.updated_at || '—')],
      ]);
      if (props.evidence_json) {
        try {
          const ev = JSON.parse(props.evidence_json);
          html += _kvTable('Pattern Evidence', Object.entries(ev).map(([k, v]) => [k, esc(typeof v === 'object' ? JSON.stringify(v) : String(v))]));
        } catch {/* ignore */}
      }
    }

    bodyEl.innerHTML = html;

    if (limEl) {
      limEl.innerHTML = `<strong>⚠ Limitations</strong>${_limitationsText(data.type, props)}`;
    }
  }

  function _closeEvidence() {
    document.getElementById('evidence-panel').classList.remove('open');
    State.setSelected(null);
  }

  function _kvTable(title, rows) {
    const trs = rows.map(([k, v]) => `<tr><td class="kv-key">${esc(k)}</td><td class="kv-val mono">${v}</td></tr>`).join('');
    return `<div><div class="evidence-section-label">${esc(title)}</div><table class="kv-table">${trs}</table></div>`;
  }

  function _mono(v)    { return `<span class="mono">${esc(v)}</span>`; }
  function _btcFmt(s)  { return `${(parseInt(s) / 1e8).toFixed(8)} BTC`; }

  function _limitationsText(type, props) {
    if (type === 'Alert') {
      const t = props.type || '';
      if (t.includes('coinjoin'))     return ' Pattern-based inference (input/output count + value spread). Not proof of mixing intent.';
      if (t.includes('peeling'))      return ' Graph-heuristic inference (dominant-output chain). Not proof of peel-and-spend intent.';
      return ' Algorithm-scored alert. Not proof of illicit activity.';
    }
    if (type === 'Address' && props.risk_score) return ' Risk score propagated from seed labels. Not independently verified.';
    return ' Transaction metadata only. Network-level inference — not blockchain-confirmed.';
  }

  function copyId(id) {
    if (navigator.clipboard) navigator.clipboard.writeText(id).then(() => Utils.toast('Copied to clipboard', 'ok'));
  }

  // ── Context menu ──────────────────────────────────────────

  function _openCtxMenu(node, evt) {
    _closeCtxMenu();
    const d = node.data();
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.style.left = `${evt.clientX}px`;
    menu.style.top  = `${evt.clientY}px`;
    menu.innerHTML = `
      <div class="ctx-menu-item" data-action="expand">⊕ Expand</div>
      <div class="ctx-menu-item" data-action="focus">◎ Focus</div>
      <div class="ctx-menu-item" data-action="copy">📋 Copy ID</div>
    `;
    menu.querySelector('[data-action="expand"]').onclick = () => { expandNode(d.id, d.type); _closeCtxMenu(); };
    menu.querySelector('[data-action="focus"]').onclick   = () => { cy.animate({ center: { eles: node }, zoom: 1.6 }, { duration: 300 }); _closeCtxMenu(); };
    menu.querySelector('[data-action="copy"]').onclick     = () => { copyId(d.id); _closeCtxMenu(); };
    document.body.appendChild(menu);
    _ctxMenuEl = menu;
  }

  function _closeCtxMenu() {
    if (_ctxMenuEl) { _ctxMenuEl.remove(); _ctxMenuEl = null; }
  }

  // ── Toolbar handlers ──────────────────────────────────────

  async function handleSearch() {
    const q = document.getElementById('graph-search-input')?.value?.trim();
    if (!q) return;
    Utils.toast('Searching…', 'info');
    try {
      const { results } = await API.search(q, State.getCase());
      if (!results.length) { Utils.toast('No matches', 'info'); return; }
      const first = results[0];
      await loadSubgraph(first.id, first.type);
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  }

  function toggleAlerts(checked) {
    showAlerts = checked;
    cy.elements('node[type="Alert"], edge[type="FLAGS"]').style('display', checked ? 'element' : 'none');
  }

  function fitView() { cy && cy.fit(undefined, 30); }
  function resetZoom() { cy && cy.zoom(1); }

  function esc(v) {
    return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  return { init, loadSubgraph, expandNode, centerOn, handleSearch, toggleAlerts, fitView, resetZoom, copyId, _closeEvidence, _openEvidence };
})();