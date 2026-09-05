/* graph.js — Cytoscape.js init, node styling, expand-hop, evidence panel */

const Graph = (() => {
  let cy = null;
  let showAlerts = false;

  // ── Cytoscape stylesheet ──────────────────────────────────

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
        'background-color': '#152238',
        'border-color': '#2E6BE6',
        'border-width': 1.5,
        'width': 110,
        'height': 36,
      },
    },
    {
      selector: 'node[type="Address"]',
      style: {
        'shape': 'ellipse',
        'background-color': '#2E6BE6',
        'border-color': '#DCE2ED',
        'border-width': 2,
        'width': 72,
        'height': 72,
        'font-size': '8px',
        'text-max-width': '62px',
      },
    },
    // Risk-level borders on address nodes
    {
      selector: 'node[type="Address"][riskClass="risk-high"]',
      style: { 'border-color': '#C0392B', 'border-width': 3 },
    },
    {
      selector: 'node[type="Address"][riskClass="risk-med"]',
      style: { 'border-color': '#B8860B', 'border-width': 3 },
    },
    {
      selector: 'node[type="Address"][riskClass="risk-low"]',
      style: { 'border-color': '#2E8B57', 'border-width': 2 },
    },
    {
      selector: 'node[type="Alert"]',
      style: {
        'shape': 'triangle',
        'background-color': '#C0392B',
        'border-color': '#FDECEA',
        'border-width': 1,
        'width': 36,
        'height': 36,
        'label': '⚠',
        'font-size': '14px',
        'color': '#FFFFFF',
      },
    },
    // Selected state
    {
      selector: ':selected',
      style: {
        'border-color': '#F5C518',
        'border-width': 3,
        'overlay-color': 'rgba(245,197,24,.08)',
        'overlay-padding': 4,
      },
    },
    // Edges
    {
      selector: 'edge',
      style: {
        'width': 1.5,
        'line-color': '#B8C4D8',
        'target-arrow-color': '#B8C4D8',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.9,
        'curve-style': 'bezier',
        'label': 'data(amountLabel)',
        'font-family': 'JetBrains Mono, monospace',
        'font-size': '8px',
        'color': '#5B6472',
        'text-rotation': 'autorotate',
        'text-background-color': '#F4F6FA',
        'text-background-opacity': 0.8,
        'text-background-padding': '2px',
        'min-zoomed-font-size': 8,
      },
    },
    {
      selector: 'edge[type="SPENDS"]',
      style: { 'line-color': '#2E6BE6', 'target-arrow-color': '#2E6BE6' },
    },
    {
      selector: 'edge[type="PAYS_TO"]',
      style: { 'line-color': '#2E8B57', 'target-arrow-color': '#2E8B57' },
    },
    {
      selector: 'edge[type="FLAGS"]',
      style: {
        'line-color': '#C0392B',
        'target-arrow-color': '#C0392B',
        'line-style': 'dashed',
        'line-dash-pattern': [5, 3],
        'width': 1,
      },
    },
    // Faded — non-selected when something IS selected
    {
      selector: '.faded',
      style: { 'opacity': 0.25 },
    },
  ];

  // ── Init ──────────────────────────────────────────────────

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

    // Node click → evidence panel
    cy.on('tap', 'node', e => {
      const node = e.target;
      cy.elements().removeClass('faded');
      const connected = node.closedNeighborhood();
      cy.elements().not(connected).addClass('faded');
      _openEvidence(node.data());
    });

    // Background click → clear selection
    cy.on('tap', e => {
      if (e.target === cy) {
        cy.elements().removeClass('faded');
        _closeEvidence();
      }
    });

    // Double-click → expand node
    cy.on('dblclick', 'node', e => {
      const d = e.target.data();
      expandNode(d.id, d.type);
    });
  }

  // ── Load subgraph ─────────────────────────────────────────

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

  // ── Expand one hop (preserves existing layout) ─────────────

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
      // Layout only the newly added nodes, anchored to existing positions
      const newNodes = cy.collection(addedIds.nodes.map(id => cy.$id(id)).filter(n => n.length));
      if (newNodes.length > 0) {
        newNodes.layout({
          name: 'dagre',
          rankDir: 'LR',
          nodeSep: 50,
          rankSep: 80,
          fit: false,
          animate: true,
          animationDuration: 300,
        }).run();
      }
      _checkCap(data);
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
  }

  // ── Add elements (deduplicated) ───────────────────────────

  function _addElements(data) {
    const added = { nodes: [], edges: [] };
    const batch = [];

    (data.nodes || []).forEach(n => {
      if (State.hasGraphNode(n.id)) return;
      State.addGraphNode(n.id, n);
      added.nodes.push(n.id);
      batch.push({
        group: 'nodes',
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
          riskClass: n.riskClass || '',
          amountLabel: '',
          props: n.props || {},
        },
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
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
          amount_btc: amtBtc,
          amountLabel: amtBtc != null ? amtBtc.toFixed(4) + ' ₿' : '',
        },
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
  }

  // ── Cap banner ────────────────────────────────────────────

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

  // ── Center on a node (cross-section navigation) ───────────

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

  function _openEvidence(data) {
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

    let html = '';

    if (data.type === 'Transaction') {
      const conf = props.confidence ? `${(parseFloat(props.confidence) * 100).toFixed(1)}%` : null;
      html += _evSection('Transaction', [
        ['TXID',         _mono(data.id)],
        ['Timestamp',    props.timestamp || '—'],
        ['Source IP',    props.src_ip || '—'],
        ['Dest IP',      props.dst_ip || '—'],
        ['Geo',          props.geo_country || '—'],
        ['ASN',          props.asn || '—'],
        ['Total In',     props.total_input_sats  ? _btcFmt(props.total_input_sats)  : '—'],
        ['Total Out',    props.total_output_sats ? _btcFmt(props.total_output_sats) : '—'],
        ['Implied Fee',  props.implied_fee_sats  ? _btcFmt(props.implied_fee_sats)  : '—'],
        ['Source File',  props.source_file ? `${props.source_file} · ${props.source_row}` : '—'],
      ]);
      html += `<button class="btn btn-secondary btn-sm" style="margin-top:4px" onclick="Graph.expandNode('${esc(data.id)}','Transaction')">⊕ Expand one hop</button>`;
    }

    if (data.type === 'Address') {
      html += _evSection('Address', [
        ['Value',         _mono(data.id)],
        ['Entity',        props.entity_name || '—'],
        ['Type',          props.entity_type || '—'],
        ['Risk Score',    props.risk_score != null ? parseFloat(props.risk_score).toFixed(2) : '—'],
        ['Label Conf.',   props.label_confidence != null ? `${(parseFloat(props.label_confidence) * 100).toFixed(0)}%` : '—'],
        ['Source',        props.source || '—'],
        ['First Flagged', props.first_flagged_txid ? _mono(props.first_flagged_txid.substring(0,16) + '…') : '—'],
      ]);
      html += `<button class="btn btn-secondary btn-sm" style="margin-top:4px" onclick="Graph.expandNode('${esc(data.id)}','Address')">⊕ Expand one hop</button>`;
    }

    if (data.type === 'Alert') {
      html += _evSection('Alert', [
        ['Alert ID',    _mono(data.id)],
        ['Type',        props.type || '—'],
        ['Confidence',  props.confidence ? `${(parseFloat(props.confidence) * 100).toFixed(1)}%` : '—'],
        ['TXID',        props.txid ? _mono(props.txid.substring(0,16) + '…') : '—'],
        ['Updated',     props.updated_at || '—'],
      ]);
      if (props.evidence_json) {
        try {
          const ev = JSON.parse(props.evidence_json);
          html += _evSection('Pattern Evidence', Object.entries(ev).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]));
        } catch {/* ignore */}
      }
    }

    bodyEl.innerHTML = html;

    // Always show the limitations notice
    if (limEl) {
      limEl.innerHTML = `<strong>⚠ Limitations</strong>${_limitationsText(data.type, props)}`;
    }
  }

  function _closeEvidence() {
    document.getElementById('evidence-panel').classList.remove('open');
    State.setSelected(null);
  }

  function _evSection(title, fields) {
    const rows = fields.map(([k, v]) => `
      <div class="evidence-field">
        <span class="evidence-key">${esc(k)}</span>
        <span class="evidence-val">${v}</span>
      </div>`).join('');
    return `<div><div class="evidence-section-label">${esc(title)}</div>${rows}</div>`;
  }

  function _mono(v)    { return `<span class="evidence-val mono">${esc(v)}</span>`; }
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

  // ── Toolbar: search handler ───────────────────────────────

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

  // ── Toolbar: toggle alerts overlay ───────────────────────

  function toggleAlerts(checked) {
    showAlerts = checked;
    cy.elements('node[type="Alert"], edge[type="FLAGS"]').style('display', checked ? 'element' : 'none');
  }

  // ── Toolbar: fit view ─────────────────────────────────────

  function fitView() { cy && cy.fit(undefined, 30); }
  function resetZoom() { cy && cy.zoom(1); }

  function esc(v) {
    return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ── Public API ────────────────────────────────────────────

  return { init, loadSubgraph, expandNode, centerOn, handleSearch, toggleAlerts, fitView, resetZoom, _closeEvidence };
})();
