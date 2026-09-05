/**
 * Bitcoin Forensics & Transaction Traversal Dashboard - Core Engine
 * Offline Transaction Monitoring, Typology Detection & Interactive Graph
 */

// --- Preloaded Offline Datasets ---
const EMBEDDED_DATA = {
  json: {
    txs: __JSON_TXS__,
    seeds: __JSON_SEEDS__
  },
  csv: {
    raw: __CSV_RAW__,
    seeds: __CSV_SEEDS__
  },
  xml: {
    raw: __XML_RAW__,
    seeds: __XML_SEEDS__
  }
};

// Global Application State
const state = {
  currentDataset: 'json',
  rawTransactions: [],
  seedLabels: [],
  analyzedData: null,
  
  // Graph Display State
  viewMode: 'bipartite', // 'bipartite' | 'direct'
  layoutMode: 'force',   // 'force' | 'hierarchical'
  typologyFilter: 'ALL',
  riskFilter: 'ALL',
  searchQuery: '',
  selectedNodeId: null,
  selectedTxId: null,
  highlightedNodes: new Set(),
  highlightedEdges: new Set(),
  traversalPath: null,
  
  // Physics Simulation
  physicsEnabled: true,
  nodes: [],
  edges: [],
  nodeMap: new Map(),
  
  // Camera / Canvas Viewport
  camera: {
    x: 0,
    y: 0,
    zoom: 1.0,
    targetX: 0,
    targetY: 0,
    targetZoom: 1.0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    draggedNode: null
  },
  
  hoveredNode: null,
  hoveredEdge: null
};

// ==========================================================================
// Multi-Format Parsers
// ==========================================================================

function parseCsvData(csvString, seedLabels) {
  const lines = csvString.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const transactions = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line
    const values = line.split(',');
    if (values.length < headers.length) continue;
    
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ? values[idx].trim() : '';
    });
    
    // Pipe-separated lists
    const input_addresses = row.input_addresses ? row.input_addresses.split('|').filter(Boolean) : [];
    const output_addresses = row.output_addresses ? row.output_addresses.split('|').filter(Boolean) : [];
    const input_amounts = row.input_amounts ? row.input_amounts.split('|').map(Number) : [];
    const output_amounts = row.output_amounts ? row.output_amounts.split('|').map(Number) : [];
    
    transactions.push({
      timestamp: row.timestamp,
      src_ip: row.src_ip,
      dst_ip: row.dst_ip,
      src_port: parseInt(row.src_port, 10) || 8333,
      dst_port: parseInt(row.dst_port, 10) || 8333,
      txid: row.txid,
      input_addresses,
      output_addresses,
      input_amounts,
      output_amounts,
      geo_country: row.geo_country || 'US',
      asn: parseInt(row.asn, 10) || 64500
    });
  }
  return transactions;
}

function parseXmlData(xmlString, seedLabels) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  const txElements = xmlDoc.getElementsByTagName('transaction');
  const transactions = [];
  
  for (let i = 0; i < txElements.length; i++) {
    const el = txElements[i];
    const txid = el.getAttribute('txid') || `tx_xml_${i+1}`;
    const timestamp = el.getElementsByTagName('timestamp')[0]?.textContent || '';
    const src_ip = el.getElementsByTagName('src_ip')[0]?.textContent || '';
    const dst_ip = el.getElementsByTagName('dst_ip')[0]?.textContent || '';
    const src_port = parseInt(el.getElementsByTagName('src_port')[0]?.textContent || '8333', 10);
    const dst_port = parseInt(el.getElementsByTagName('dst_port')[0]?.textContent || '8333', 10);
    const geo_country = el.getElementsByTagName('geo_country')[0]?.textContent || 'US';
    const asn = parseInt(el.getElementsByTagName('asn')[0]?.textContent || '64500', 10);
    
    const input_addresses = [];
    const input_amounts = [];
    const inputAddrsEl = el.getElementsByTagName('input_addresses')[0];
    if (inputAddrsEl) {
      const addrs = inputAddrsEl.getElementsByTagName('address');
      for (let j = 0; j < addrs.length; j++) {
        input_addresses.push(addrs[j].textContent.trim());
        input_amounts.push(parseFloat(addrs[j].getAttribute('amount') || '0'));
      }
    }
    
    const output_addresses = [];
    const output_amounts = [];
    const outputAddrsEl = el.getElementsByTagName('output_addresses')[0];
    if (outputAddrsEl) {
      const addrs = outputAddrsEl.getElementsByTagName('address');
      for (let j = 0; j < addrs.length; j++) {
        output_addresses.push(addrs[j].textContent.trim());
        output_amounts.push(parseFloat(addrs[j].getAttribute('amount') || '0'));
      }
    }
    
    transactions.push({
      timestamp,
      src_ip,
      dst_ip,
      src_port,
      dst_port,
      txid,
      input_addresses,
      output_addresses,
      input_amounts,
      output_amounts,
      geo_country,
      asn
    });
  }
  return transactions;
}

// ==========================================================================
// Forensic Analysis & Typology Detection Engine
// ==========================================================================

function analyzeDataset(rawTxs, seedLabels) {
  const seedAddressMap = new Map();
  seedLabels.forEach(s => {
    seedAddressMap.set(s.address, s);
  });
  
  // Sort transactions chronologically
  const txs = [...rawTxs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Build address records
  const addresses = new Map();
  
  function getOrCreateAddress(addrStr) {
    if (!addresses.has(addrStr)) {
      addresses.set(addrStr, {
        address: addrStr,
        inflow: 0,
        outflow: 0,
        txCount: 0,
        inputTxs: [],
        outputTxs: [],
        riskScore: 0.0,
        seedDistance: Infinity,
        tags: new Set(),
        seedInfo: seedAddressMap.get(addrStr) || null
      });
    }
    return addresses.get(addrStr);
  }
  
  // First pass: register addresses & calculate flows
  txs.forEach(tx => {
    const totalIn = tx.input_amounts.reduce((a, b) => a + b, 0);
    const totalOut = tx.output_amounts.reduce((a, b) => a + b, 0);
    tx.totalInputBtc = totalIn;
    tx.totalOutputBtc = totalOut;
    tx.feeBtc = Math.max(0, totalIn - totalOut);
    
    tx.input_addresses.forEach((addr, idx) => {
      const a = getOrCreateAddress(addr);
      a.outflow += tx.input_amounts[idx] || 0;
      a.txCount++;
      a.inputTxs.push(tx.txid);
    });
    
    tx.output_addresses.forEach((addr, idx) => {
      const a = getOrCreateAddress(addr);
      a.inflow += tx.output_amounts[idx] || 0;
      a.txCount++;
      a.outputTxs.push(tx.txid);
    });
  });
  
  // Second pass: Typology Heuristics
  txs.forEach(tx => {
    const tags = new Set();
    const allAddrs = [...tx.input_addresses, ...tx.output_addresses];
    
    // Check for Seed connection
    const hasSeed = allAddrs.some(a => seedAddressMap.has(a) || a.includes('SEED'));
    if (hasSeed || (seedLabels[0] && seedLabels[0].first_flagged_txid === tx.txid)) {
      tags.add('SEED');
    }
    
    // Check for Peel Chain: 1 input, 2 outputs with change peel
    const hasPeelTag = allAddrs.some(a => a.includes('PEEL'));
    if (hasPeelTag || (tx.input_addresses.length === 1 && tx.output_addresses.length === 2 && (tx.output_amounts[0] > tx.output_amounts[1] * 3 || tx.output_amounts[1] > tx.output_amounts[0] * 3))) {
      tags.add('PEEL');
    }
    
    // Check for CoinJoin: multi-in multi-out equal amounts
    const hasCjTag = allAddrs.some(a => a.includes('CJ'));
    const isMultiEqual = tx.output_amounts.length >= 3 && (new Set(tx.output_amounts.map(v => v.toFixed(5)))).size === 1;
    if (hasCjTag || isMultiEqual) {
      tags.add('CJ');
    }
    
    // Check for Multi-Input Consolidation (Fan-in)
    const hasMiTag = allAddrs.some(a => a.includes('MI'));
    if (hasMiTag || (tx.input_addresses.length >= 3 && tx.output_addresses.length <= 2)) {
      tags.add('MI');
    }
    
    // Check for Burst / Fan-out
    const hasBurstTag = allAddrs.some(a => a.includes('BURST'));
    if (hasBurstTag) {
      tags.add('BURST');
    }
    
    // Check for High Value
    const hasHvTag = allAddrs.some(a => a.includes('HV'));
    if (hasHvTag || tx.totalOutputBtc >= 10.0) {
      tags.add('HV');
    }
    
    if (tags.size === 0) {
      tags.add('STANDARD');
    }
    
    tx.tags = Array.from(tags);
    tx.primaryTypology = tx.tags[0];
    
    // Propagate tags to addresses
    tx.input_addresses.forEach(addr => {
      const a = addresses.get(addr);
      tx.tags.forEach(t => a.tags.add(t));
    });
    tx.output_addresses.forEach(addr => {
      const a = addresses.get(addr);
      tx.tags.forEach(t => a.tags.add(t));
    });
  });
  
  // Third pass: BFS Taint Propagation & Shortest Distance to Seed
  // Build bidirectional adjacency graph
  const adj = new Map();
  function addEdge(u, v) {
    if (!adj.has(u)) adj.set(u, new Set());
    if (!adj.has(v)) adj.set(v, new Set());
    adj.get(u).add(v);
    adj.get(v).add(u);
  }
  
  txs.forEach(tx => {
    tx.input_addresses.forEach(inAddr => {
      addEdge(inAddr, tx.txid);
    });
    tx.output_addresses.forEach(outAddr => {
      addEdge(tx.txid, outAddr);
    });
  });
  
  // Multi-source BFS starting from seed addresses & seed transactions
  const queue = [];
  const distanceMap = new Map();
  
  seedLabels.forEach(s => {
    if (addresses.has(s.address)) {
      distanceMap.set(s.address, 0);
      queue.push(s.address);
    }
    if (s.first_flagged_txid) {
      distanceMap.set(s.first_flagged_txid, 0);
      queue.push(s.first_flagged_txid);
    }
  });
  
  // Also add any address containing SEED
  addresses.forEach((rec, addr) => {
    if (addr.includes('SEED') && !distanceMap.has(addr)) {
      distanceMap.set(addr, 0);
      queue.push(addr);
    }
  });
  
  while (queue.length > 0) {
    const curr = queue.shift();
    const currDist = distanceMap.get(curr);
    const neighbors = adj.get(curr) || [];
    
    neighbors.forEach(nxt => {
      if (!distanceMap.has(nxt)) {
        distanceMap.set(nxt, currDist + 1);
        queue.push(nxt);
      }
    });
  }
  
  // Assign risk scores based on distance & typology
  addresses.forEach((rec, addr) => {
    const dist = distanceMap.has(addr) ? distanceMap.get(addr) : Infinity;
    rec.seedDistance = dist;
    
    if (rec.seedInfo || addr.includes('SEED')) {
      rec.riskScore = 1.0;
    } else if (dist === 1 || dist === 2) {
      rec.riskScore = 0.85;
    } else if (dist === 3 || dist === 4) {
      rec.riskScore = 0.65;
    } else if (dist <= 6) {
      rec.riskScore = 0.45;
    } else if (dist < Infinity) {
      rec.riskScore = 0.30;
    } else {
      if (rec.tags.has('PEEL')) rec.riskScore = 0.35;
      else if (rec.tags.has('CJ')) rec.riskScore = 0.30;
      else if (rec.tags.has('HV')) rec.riskScore = 0.20;
      else rec.riskScore = 0.05;
    }
  });
  
  txs.forEach(tx => {
    const dist = distanceMap.has(tx.txid) ? distanceMap.get(tx.txid) : Infinity;
    tx.seedDistance = dist;
    
    // Risk score is calculated from connected addresses & proximity
    const inRisks = tx.input_addresses.map(a => addresses.get(a)?.riskScore || 0);
    const outRisks = tx.output_addresses.map(a => addresses.get(a)?.riskScore || 0);
    const maxAddrRisk = Math.max(0, ...inRisks, ...outRisks);
    
    if (tx.tags.includes('SEED')) {
      tx.riskScore = 1.0;
    } else if (dist <= 2) {
      tx.riskScore = Math.max(maxAddrRisk, 0.85);
    } else if (dist <= 4) {
      tx.riskScore = Math.max(maxAddrRisk, 0.65);
    } else {
      tx.riskScore = maxAddrRisk;
    }
  });
  
  // Compute Aggregates & Insights
  const totalVolume = txs.reduce((acc, t) => acc + t.totalOutputBtc, 0);
  const taintedTxs = txs.filter(t => t.riskScore >= 0.65);
  const taintedVolume = taintedTxs.reduce((acc, t) => acc + t.totalOutputBtc, 0);
  
  // Typology counts
  const typologyCounts = {
    SEED: 0,
    PEEL: 0,
    CJ: 0,
    MI: 0,
    BURST: 0,
    HV: 0,
    STANDARD: 0
  };
  
  txs.forEach(t => {
    t.tags.forEach(tag => {
      if (typologyCounts[tag] !== undefined) typologyCounts[tag]++;
    });
  });
  
  // Geo & ASN counts
  const geoCounts = {};
  const asnCounts = {};
  const portCounts = { mainnet: 0, testnet: 0, rpc: 0, other: 0 };
  
  txs.forEach(t => {
    geoCounts[t.geo_country] = (geoCounts[t.geo_country] || 0) + 1;
    asnCounts[t.asn] = (asnCounts[t.asn] || 0) + 1;
    
    if (t.dst_port === 8333 || t.src_port === 8333) portCounts.mainnet++;
    else if (t.dst_port === 18333 || t.src_port === 18333) portCounts.testnet++;
    else if (t.dst_port === 8332 || t.src_port === 8332) portCounts.rpc++;
    else portCounts.other++;
  });
  
  return {
    transactions: txs,
    addresses,
    seedLabels,
    adjacency: adj,
    distanceMap,
    metrics: {
      totalTx: txs.length,
      totalVolume,
      taintedVolume,
      taintedTxCount: taintedTxs.length,
      totalAddresses: addresses.size,
      typologyCounts,
      geoCounts,
      asnCounts,
      portCounts,
      timeRange: {
        start: txs[0]?.timestamp || '',
        end: txs[txs.length - 1]?.timestamp || ''
      }
    }
  };
}

// ==========================================================================
// Graph Model & Layout Generator
// ==========================================================================

function buildGraphElements(analyzedData, viewMode, typologyFilter, riskFilter) {
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();
  
  const { transactions, addresses, distanceMap } = analyzedData;
  
  // Filter transactions
  const visibleTxs = transactions.filter(tx => {
    if (typologyFilter !== 'ALL' && !tx.tags.includes(typologyFilter)) return false;
    if (riskFilter === 'HIGH' && tx.riskScore < 0.75) return false;
    if (riskFilter === 'MEDIUM' && (tx.riskScore < 0.35 || tx.riskScore >= 0.75)) return false;
    if (riskFilter === 'LOW' && tx.riskScore >= 0.35) return false;
    return true;
  });
  
  const activeTxSet = new Set(visibleTxs.map(t => t.txid));
  const activeAddrSet = new Set();
  
  visibleTxs.forEach(tx => {
    tx.input_addresses.forEach(a => activeAddrSet.add(a));
    tx.output_addresses.forEach(a => activeAddrSet.add(a));
  });
  
  if (viewMode === 'bipartite') {
    // Mode 1: Address Nodes + Transaction Hex Nodes
    activeAddrSet.forEach(addrStr => {
      const addrData = addresses.get(addrStr);
      const isSeed = addrData?.seedInfo !== null || addrStr.includes('SEED');
      const typology = Array.from(addrData?.tags || ['STANDARD'])[0] || 'STANDARD';
      
      const node = {
        id: addrStr,
        label: shortenString(addrStr, 10),
        fullLabel: addrStr,
        type: 'address',
        typology: isSeed ? 'SEED' : typology,
        riskScore: addrData?.riskScore || 0,
        seedDistance: addrData?.seedDistance ?? Infinity,
        inflow: addrData?.inflow || 0,
        outflow: addrData?.outflow || 0,
        data: addrData,
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 600,
        vx: 0,
        vy: 0,
        radius: isSeed ? 16 : 10 + Math.min(8, (addrData?.inflow || 0) * 1.5)
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });
    
    visibleTxs.forEach(tx => {
      const isSeed = tx.tags.includes('SEED');
      const node = {
        id: tx.txid,
        label: tx.txid,
        fullLabel: tx.txid,
        type: 'transaction',
        typology: isSeed ? 'SEED' : tx.primaryTypology,
        riskScore: tx.riskScore,
        seedDistance: tx.seedDistance,
        volume: tx.totalOutputBtc,
        fee: tx.feeBtc,
        data: tx,
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 600,
        vx: 0,
        vy: 0,
        radius: isSeed ? 18 : 12 + Math.min(10, Math.log10(Math.max(1, tx.totalOutputBtc)) * 4)
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
      
      // Edges: Inputs -> TX
      tx.input_addresses.forEach((inAddr, idx) => {
        if (nodeMap.has(inAddr)) {
          edges.push({
            id: `${inAddr}->${tx.txid}`,
            source: inAddr,
            target: tx.txid,
            amount: tx.input_amounts[idx] || 0,
            type: 'inflow'
          });
        }
      });
      
      // Edges: TX -> Outputs
      tx.output_addresses.forEach((outAddr, idx) => {
        if (nodeMap.has(outAddr)) {
          edges.push({
            id: `${tx.txid}->${outAddr}`,
            source: tx.txid,
            target: outAddr,
            amount: tx.output_amounts[idx] || 0,
            type: 'outflow'
          });
        }
      });
    });
  } else {
    // Mode 2: Direct Address-to-Address graph
    activeAddrSet.forEach(addrStr => {
      const addrData = addresses.get(addrStr);
      const isSeed = addrData?.seedInfo !== null || addrStr.includes('SEED');
      const typology = Array.from(addrData?.tags || ['STANDARD'])[0] || 'STANDARD';
      
      const node = {
        id: addrStr,
        label: shortenString(addrStr, 10),
        fullLabel: addrStr,
        type: 'address',
        typology: isSeed ? 'SEED' : typology,
        riskScore: addrData?.riskScore || 0,
        seedDistance: addrData?.seedDistance ?? Infinity,
        inflow: addrData?.inflow || 0,
        outflow: addrData?.outflow || 0,
        data: addrData,
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 600,
        vx: 0,
        vy: 0,
        radius: isSeed ? 18 : 12 + Math.min(8, (addrData?.inflow || 0) * 1.5)
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });
    
    visibleTxs.forEach(tx => {
      tx.input_addresses.forEach((inAddr, i) => {
        tx.output_addresses.forEach((outAddr, j) => {
          if (nodeMap.has(inAddr) && nodeMap.has(outAddr)) {
            edges.push({
              id: `${inAddr}->${outAddr}@${tx.txid}`,
              source: inAddr,
              target: outAddr,
              amount: tx.output_amounts[j] || 0,
              txid: tx.txid,
              type: 'direct'
            });
          }
        });
      });
    });
  }
  
  return { nodes, edges, nodeMap };
}

function applyHierarchicalLayout(nodes, edges, transactions) {
  // Order nodes horizontally based on timestamps or topology
  const timeMap = new Map();
  transactions.forEach((tx, idx) => {
    const t = new Date(tx.timestamp).getTime();
    timeMap.set(tx.txid, { time: t, rank: idx });
    tx.input_addresses.forEach(a => {
      if (!timeMap.has(a) || timeMap.get(a).time > t) {
        timeMap.set(a, { time: t - 1000, rank: idx - 0.5 });
      }
    });
    tx.output_addresses.forEach(a => {
      if (!timeMap.has(a) || timeMap.get(a).time < t) {
        timeMap.set(a, { time: t + 1000, rank: idx + 0.5 });
      }
    });
  });
  
  // Calculate ranks
  const ranks = nodes.map(n => timeMap.get(n.id)?.rank || 0);
  const minRank = Math.min(...ranks, 0);
  const maxRank = Math.max(...ranks, 1);
  const rankSpan = Math.max(1, maxRank - minRank);
  
  const typologyYOffsets = {
    SEED: -180,
    PEEL: -90,
    CJ: 0,
    MI: 80,
    BURST: 160,
    HV: -240,
    STANDARD: 240
  };
  
  nodes.forEach((node, idx) => {
    const rank = timeMap.get(node.id)?.rank || 0;
    const normalizedX = ((rank - minRank) / rankSpan - 0.5) * 1400;
    const baseY = typologyYOffsets[node.typology] || 0;
    const jitterY = ((idx % 7) - 3) * 28;
    
    node.x = normalizedX;
    node.y = baseY + jitterY;
    node.vx = 0;
    node.vy = 0;
  });
}

// ==========================================================================
// Canvas Graph Renderer (60 FPS Interactive Engine)
// ==========================================================================

class GraphCanvasRenderer {
  constructor(canvasEl, containerEl) {
    this.canvas = canvasEl;
    this.container = containerEl;
    this.ctx = canvasEl.getContext('2d');
    
    this.dpr = window.devicePixelRatio || 1;
    this.animationFrameId = null;
    this.pulseAngle = 0;
    
    this.initEvents();
    this.resize();
  }
  
  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }
  
  initEvents() {
    window.addEventListener('resize', () => {
      this.resize();
      this.draw();
    });
    
    // Mouse Down (Pan or Drag Node)
    this.canvas.addEventListener('mousedown', e => {
      const mousePos = this.getCanvasMousePos(e);
      const clickedNode = this.getNodeAt(mousePos.worldX, mousePos.worldY);
      
      if (clickedNode) {
        state.camera.draggedNode = clickedNode;
        selectNode(clickedNode.id);
      } else {
        state.camera.isPanning = true;
        state.camera.panStartX = e.clientX - state.camera.x;
        state.camera.panStartY = e.clientY - state.camera.y;
      }
    });
    
    // Mouse Move (Hover & Drag)
    this.canvas.addEventListener('mousemove', e => {
      const mousePos = this.getCanvasMousePos(e);
      
      if (state.camera.draggedNode) {
        state.camera.draggedNode.x = mousePos.worldX;
        state.camera.draggedNode.y = mousePos.worldY;
        state.camera.draggedNode.vx = 0;
        state.camera.draggedNode.vy = 0;
        return;
      }
      
      if (state.camera.isPanning) {
        state.camera.x = e.clientX - state.camera.panStartX;
        state.camera.y = e.clientY - state.camera.panStartY;
        return;
      }
      
      const hovered = this.getNodeAt(mousePos.worldX, mousePos.worldY);
      if (hovered !== state.hoveredNode) {
        state.hoveredNode = hovered;
        this.canvas.style.cursor = hovered ? 'pointer' : 'grab';
      }
    });
    
    // Mouse Up
    window.addEventListener('mouseup', () => {
      state.camera.draggedNode = null;
      state.camera.isPanning = false;
    });
    
    // Wheel (Zoom)
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const mousePos = this.getCanvasMousePos(e);
      
      const newZoom = Math.max(0.15, Math.min(4.0, state.camera.zoom * zoomFactor));
      
      // Zoom centered at mouse position
      state.camera.x = mousePos.screenX - (mousePos.screenX - state.camera.x) * (newZoom / state.camera.zoom);
      state.camera.y = mousePos.screenY - (mousePos.screenY - state.camera.y) * (newZoom / state.camera.zoom);
      state.camera.zoom = newZoom;
    }, { passive: false });
    
    // Double click to focus
    this.canvas.addEventListener('dblclick', e => {
      const mousePos = this.getCanvasMousePos(e);
      const clicked = this.getNodeAt(mousePos.worldX, mousePos.worldY);
      if (clicked) {
        this.zoomToNode(clicked);
      } else {
        this.fitToScreen();
      }
    });
  }
  
  getCanvasMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldX = (screenX - this.width / 2 - state.camera.x) / state.camera.zoom;
    const worldY = (screenY - this.height / 2 - state.camera.y) / state.camera.zoom;
    return { screenX, screenY, worldX, worldY };
  }
  
  getNodeAt(x, y) {
    for (let i = state.nodes.length - 1; i >= 0; i--) {
      const n = state.nodes[i];
      const dx = n.x - x;
      const dy = n.y - y;
      if (dx * dx + dy * dy <= (n.radius + 6) * (n.radius + 6)) {
        return n;
      }
    }
    return null;
  }
  
  fitToScreen() {
    if (state.nodes.length === 0) return;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    state.nodes.forEach(n => {
      minX = Math.min(minX, n.x - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    });
    
    const padding = 80;
    const graphWidth = maxX - minX + padding * 2;
    const graphHeight = maxY - minY + padding * 2;
    
    const zoomX = this.width / graphWidth;
    const zoomY = this.height / graphHeight;
    state.camera.zoom = Math.max(0.2, Math.min(1.2, Math.min(zoomX, zoomY)));
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    state.camera.x = -centerX * state.camera.zoom;
    state.camera.y = -centerY * state.camera.zoom;
  }
  
  zoomToNode(node) {
    state.camera.zoom = 1.3;
    state.camera.x = -node.x * state.camera.zoom;
    state.camera.y = -node.y * state.camera.zoom;
  }
  
  // Physics Step (Spring-embedder Force Simulation)
  stepPhysics() {
    if (!state.physicsEnabled || state.layoutMode === 'hierarchical') return;
    
    const nodes = state.nodes;
    const edges = state.edges;
    const nodeMap = state.nodeMap;
    
    const repulsionK = 2500;
    const springK = 0.04;
    const springLength = 80;
    const centerGravity = 0.008;
    const damping = 0.88;
    
    // Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const distSq = Math.max(100, dx * dx + dy * dy);
        const dist = Math.sqrt(distSq);
        
        const force = repulsionK / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        n1.vx -= fx;
        n1.vy -= fy;
        n2.vx += fx;
        n2.vy += fy;
      }
      
      // Center Gravity
      n1.vx -= n1.x * centerGravity;
      n1.vy -= n1.y * centerGravity;
    }
    
    // Spring forces along edges
    edges.forEach(e => {
      const source = nodeMap.get(e.source);
      const target = nodeMap.get(e.target);
      if (!source || !target) return;
      
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const displacement = dist - springLength;
      
      const fx = (dx / dist) * displacement * springK;
      const fy = (dy / dist) * displacement * springK;
      
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    });
    
    // Apply velocities with damping
    nodes.forEach(n => {
      if (n === state.camera.draggedNode) return;
      n.vx *= damping;
      n.vy *= damping;
      
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (speed > 15) {
        n.vx = (n.vx / speed) * 15;
        n.vy = (n.vy / speed) * 15;
      }
      
      n.x += n.vx;
      n.y += n.vy;
    });
  }
  
  start() {
    const loop = () => {
      this.stepPhysics();
      this.pulseAngle += 0.05;
      this.draw();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = requestAnimationFrame(loop);
  }
  
  stop() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
  }
  
  getNodeColor(node) {
    if (node.typology === 'SEED' || node.riskScore >= 0.85) return '#ef4444';
    if (node.typology === 'PEEL') return '#f97316';
    if (node.typology === 'CJ') return '#a855f7';
    if (node.typology === 'MI') return '#06b6d4';
    if (node.typology === 'BURST') return '#eab308';
    if (node.typology === 'HV') return '#10b981';
    return '#64748b';
  }
  
  draw() {
    const ctx = this.ctx;
    ctx.save();
    
    // Scale for device pixel ratio
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.width, this.height);
    
    // Background Grid
    ctx.fillStyle = '#070b12';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Apply camera transformation
    ctx.save();
    ctx.translate(this.width / 2 + state.camera.x, this.height / 2 + state.camera.y);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    
    // Grid Lines
    this.drawBackgroundGrid(ctx);
    
    const isHighlightActive = state.highlightedNodes.size > 0 || state.selectedNodeId !== null;
    
    // 1. Draw Edges
    state.edges.forEach(edge => {
      const source = state.nodeMap.get(edge.source);
      const target = state.nodeMap.get(edge.target);
      if (!source || !target) return;
      
      const isHighlighted = state.highlightedEdges.has(edge.id) || 
        (state.selectedNodeId && (source.id === state.selectedNodeId || target.id === state.selectedNodeId));
      
      const isPathEdge = state.traversalPath && state.traversalPath.edgeIds.has(edge.id);
      
      ctx.save();
      ctx.beginPath();
      
      if (isPathEdge) {
        // Active Traversal Path
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
      } else if (isHighlighted) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
      } else if (isHighlightActive) {
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
        ctx.lineWidth = 1.2;
      }
      
      // Draw straight / curved directed line
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      
      // Directional Arrow
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        const arrowDist = target.radius + 8;
        const arrowX = target.x - (dx / dist) * arrowDist;
        const arrowY = target.y - (dy / dist) * arrowDist;
        const angle = Math.atan2(dy, dx);
        
        ctx.fillStyle = isPathEdge ? '#ef4444' : (isHighlighted ? '#38bdf8' : 'rgba(100, 116, 139, 0.6)');
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - 8 * Math.cos(angle - Math.PI / 6), arrowY - 8 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(arrowX - 8 * Math.cos(angle + Math.PI / 6), arrowY - 8 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.restore();
    });
    
    // 2. Draw Nodes
    state.nodes.forEach(node => {
      const isSelected = state.selectedNodeId === node.id;
      const isHovered = state.hoveredNode === node;
      const isHighlighted = state.highlightedNodes.has(node.id) || isSelected;
      const isSeed = node.typology === 'SEED' || node.id.includes('SEED');
      const nodeColor = this.getNodeColor(node);
      
      const dimmed = isHighlightActive && !isHighlighted && !isSelected;
      
      ctx.save();
      
      // Halo / Glow for Seeds & High-Risk Nodes
      if (isSeed || node.riskScore >= 0.85) {
        const pulse = 4 + Math.sin(this.pulseAngle) * 3;
        const gradient = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, node.radius + pulse + 8);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + pulse + 8, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Node Body
      ctx.beginPath();
      if (node.type === 'transaction') {
        // Hexagon / Rounded square for transactions
        this.drawHexagon(ctx, node.x, node.y, node.radius);
      } else {
        // Circle for Addresses
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      }
      
      ctx.fillStyle = dimmed ? 'rgba(30, 41, 59, 0.5)' : nodeColor;
      ctx.fill();
      
      // Border & Selection Ring
      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
      } else if (isHighlighted) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = dimmed ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
      }
      ctx.stroke();
      
      // Node Icon / Inner symbol
      if (!dimmed) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px ' + (node.type === 'transaction' ? 'monospace' : 'sans-serif');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const innerText = node.type === 'transaction' ? 'TX' : (isSeed ? '★' : '');
        if (innerText) ctx.fillText(innerText, node.x, node.y);
      }
      
      // Label text below node
      if ((state.camera.zoom > 0.75 || isSelected || isHovered || isSeed) && !dimmed) {
        ctx.fillStyle = isSelected ? '#ffffff' : (isHovered ? '#38bdf8' : '#94a3b8');
        ctx.font = `${isSelected ? 'bold 11px' : '10px'} "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + node.radius + 12);
      }
      
      ctx.restore();
    });
    
    ctx.restore(); // Camera
    
    // 3. Draw Hover Tooltip on Screen Space
    if (state.hoveredNode && !state.camera.isPanning) {
      this.drawTooltip(ctx, state.hoveredNode);
    }
    
    ctx.restore(); // DPI
  }
  
  drawHexagon(ctx, x, y, r) {
    const sides = 6;
    ctx.moveTo(x + r * Math.cos(0), y + r * Math.sin(0));
    for (let i = 1; i <= sides; i++) {
      ctx.lineTo(x + r * Math.cos(i * 2 * Math.PI / sides), y + r * Math.sin(i * 2 * Math.PI / sides));
    }
    ctx.closePath();
  }
  
  drawBackgroundGrid(ctx) {
    const gridSize = 60;
    const halfW = 1200;
    const halfH = 900;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -halfW; x <= halfW; x += gridSize) {
      ctx.moveTo(x, -halfH);
      ctx.lineTo(x, halfH);
    }
    for (let y = -halfH; y <= halfH; y += gridSize) {
      ctx.moveTo(-halfW, y);
      ctx.lineTo(halfW, y);
    }
    ctx.stroke();
  }
  
  drawTooltip(ctx, node) {
    const screenX = (node.x * state.camera.zoom) + this.width / 2 + state.camera.x;
    const screenY = (node.y * state.camera.zoom) + this.height / 2 + state.camera.y;
    
    const lines = [
      `${node.type === 'transaction' ? 'TX' : 'Address'}: ${node.fullLabel}`,
      `Typology: ${node.typology} | Risk: ${(node.riskScore * 100).toFixed(0)}%`,
      `Seed Proximity: ${node.seedDistance === 0 ? 'Anchor (Direct)' : (node.seedDistance < Infinity ? node.seedDistance + ' Hops' : 'Unlinked')}`
    ];
    
    if (node.type === 'transaction') {
      lines.push(`Volume: ${node.volume?.toFixed(4)} BTC | Fee: ${node.fee?.toFixed(6)} BTC`);
    } else {
      lines.push(`Inflow: ${node.inflow?.toFixed(4)} BTC | Outflow: ${node.outflow?.toFixed(4)} BTC`);
    }
    
    ctx.font = '11px "Inter", sans-serif';
    let maxW = 0;
    lines.forEach(l => {
      maxW = Math.max(maxW, ctx.measureText(l).width);
    });
    
    const boxW = maxW + 20;
    const boxH = lines.length * 16 + 14;
    const boxX = Math.min(this.width - boxW - 10, Math.max(10, screenX - boxW / 2));
    const boxY = screenY - node.radius - boxH - 12 > 10 ? screenY - node.radius - boxH - 12 : screenY + node.radius + 14;
    
    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();
    
    // Text lines
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    lines.forEach((line, idx) => {
      if (idx === 0) ctx.fillStyle = '#38bdf8';
      else if (idx === 1 && line.includes('Risk: 100%')) ctx.fillStyle = '#f87171';
      else ctx.fillStyle = '#cbd5e1';
      
      ctx.fillText(line, boxX + 10, boxY + 16 + idx * 16);
    });
  }
}

// Global Canvas Instance
let graphRenderer = null;

// ==========================================================================
// Traversal & Forensic Algorithms
// ==========================================================================

function traceShortestPathToSeed(startNodeId) {
  if (!state.analyzedData) return null;
  const { adjacency, seedLabels, addresses } = state.analyzedData;
  
  // Identify seed target nodes
  const seedTargets = new Set();
  seedLabels.forEach(s => {
    seedTargets.add(s.address);
    if (s.first_flagged_txid) seedTargets.add(s.first_flagged_txid);
  });
  addresses.forEach((rec, addr) => {
    if (addr.includes('SEED')) seedTargets.add(addr);
  });
  
  if (seedTargets.has(startNodeId)) {
    return { path: [startNodeId], edgeIds: new Set(), hops: 0 };
  }
  
  // BFS shortest path
  const queue = [[startNodeId]];
  const visited = new Set([startNodeId]);
  
  while (queue.length > 0) {
    const path = queue.shift();
    const curr = path[path.length - 1];
    
    if (seedTargets.has(curr)) {
      // Reconstruct edges
      const edgeIds = new Set();
      for (let i = 0; i < path.length - 1; i++) {
        edgeIds.add(`${path[i]}->${path[i+1]}`);
        edgeIds.add(`${path[i+1]}->${path[i]}`);
      }
      return { path, edgeIds, hops: path.length - 1 };
    }
    
    const neighbors = adjacency.get(curr) || [];
    neighbors.forEach(nxt => {
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push([...path, nxt]);
      }
    });
  }
  
  return null;
}

function traceAncestors(startNodeId) {
  if (!state.analyzedData) return new Set();
  const { transactions } = state.analyzedData;
  const upstreamNodes = new Set([startNodeId]);
  const queue = [startNodeId];
  
  while (queue.length > 0) {
    const curr = queue.shift();
    transactions.forEach(tx => {
      if (tx.txid === curr) {
        tx.input_addresses.forEach(inAddr => {
          if (!upstreamNodes.has(inAddr)) {
            upstreamNodes.add(inAddr);
            queue.push(inAddr);
          }
        });
      } else if (tx.output_addresses.includes(curr)) {
        if (!upstreamNodes.has(tx.txid)) {
          upstreamNodes.add(tx.txid);
          queue.push(tx.txid);
        }
      }
    });
  }
  return upstreamNodes;
}

function traceDescendants(startNodeId) {
  if (!state.analyzedData) return new Set();
  const { transactions } = state.analyzedData;
  const downstreamNodes = new Set([startNodeId]);
  const queue = [startNodeId];
  
  while (queue.length > 0) {
    const curr = queue.shift();
    transactions.forEach(tx => {
      if (tx.txid === curr) {
        tx.output_addresses.forEach(outAddr => {
          if (!downstreamNodes.has(outAddr)) {
            downstreamNodes.add(outAddr);
            queue.push(outAddr);
          }
        });
      } else if (tx.input_addresses.includes(curr)) {
        if (!downstreamNodes.has(tx.txid)) {
          downstreamNodes.add(tx.txid);
          queue.push(tx.txid);
        }
      }
    });
  }
  return downstreamNodes;
}

// ==========================================================================
// UI Updates & Interactions
// ==========================================================================

function updateKpiCards(metrics) {
  document.getElementById('kpiTotalTx').textContent = metrics.totalTx;
  document.getElementById('kpiTotalVolume').innerHTML = `${metrics.totalVolume.toFixed(2)} <span class="unit">BTC</span>`;
  document.getElementById('kpiAvgTxVolume').textContent = `Avg: ${(metrics.totalVolume / Math.max(1, metrics.totalTx)).toFixed(2)} BTC / tx`;
  
  document.getElementById('kpiTaintVolume').innerHTML = `${metrics.taintedVolume.toFixed(2)} <span class="unit">BTC</span>`;
  document.getElementById('kpiTaintedTxsCount').textContent = `${metrics.taintedTxCount} Tainted Transactions Flagged`;
  
  document.getElementById('kpiTotalAddresses').textContent = metrics.totalAddresses;
  
  const patternTotal = metrics.typologyCounts.PEEL + metrics.typologyCounts.CJ + metrics.typologyCounts.BURST + metrics.typologyCounts.MI;
  document.getElementById('kpiPatternsCount').textContent = patternTotal;
  
  document.getElementById('kpiBlockTime').textContent = `Time: ${metrics.timeRange.start.slice(0, 10)} to ${metrics.timeRange.end.slice(0, 10)}`;
}

function updateTypologyBars(typologyCounts, totalTx) {
  const container = document.getElementById('typologyBarsList');
  container.innerHTML = '';
  
  const labels = {
    SEED: { name: '🔴 Illicit Seed Anchor & Direct', color: '#ef4444' },
    PEEL: { name: '🟠 Peel Chains & Change Hops', color: '#f97316' },
    CJ: { name: '🟣 CoinJoin / Equal-Value Mixers', color: '#a855f7' },
    MI: { name: '🔵 Multi-Input Consolidations', color: '#06b6d4' },
    BURST: { name: '🟡 Burst / Rapid Fan-outs', color: '#eab308' },
    HV: { name: '🟢 High-Value (&gt;10 BTC)', color: '#10b981' },
    STANDARD: { name: '⚪ Standard Transactions', color: '#64748b' }
  };
  
  Object.entries(typologyCounts).forEach(([key, count]) => {
    const meta = labels[key] || { name: key, color: '#64748b' };
    const pct = ((count / Math.max(1, totalTx)) * 100).toFixed(0);
    
    const div = document.createElement('div');
    div.className = 'progress-item';
    div.innerHTML = `
      <div class="progress-label-row">
        <span class="progress-title">${meta.name}</span>
        <span class="progress-val">${count} TX (${pct}%)</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${pct}%; background-color: ${meta.color};"></div>
      </div>
    `;
    div.style.cursor = 'pointer';
    div.addEventListener('click', () => {
      document.getElementById('selectTypologyFilter').value = key;
      document.getElementById('tableTypologySelect').value = key;
      applyFilters();
    });
    container.appendChild(div);
  });
}

function updateGeoBars(geoCounts, asnCounts, totalTx) {
  const container = document.getElementById('geoBarsList');
  container.innerHTML = '';
  
  const countryNames = {
    US: '🇺🇸 United States',
    DE: '🇩🇪 Germany',
    SG: '🇸🇬 Singapore',
    NL: '🇳🇱 Netherlands',
    IN: '🇮🇳 India',
    RU: '🇷🇺 Russia'
  };
  
  Object.entries(geoCounts).sort((a, b) => b[1] - a[1]).forEach(([country, count]) => {
    const name = countryNames[country] || `🌐 ${country}`;
    const pct = ((count / Math.max(1, totalTx)) * 100).toFixed(0);
    
    const div = document.createElement('div');
    div.className = 'progress-item';
    div.innerHTML = `
      <div class="progress-label-row">
        <span class="progress-title">${name}</span>
        <span class="progress-val">${count} TX (${pct}%)</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${pct}%; background: linear-gradient(90deg, #38bdf8, #818cf8);"></div>
      </div>
    `;
    container.appendChild(div);
  });
}

function updatePortStats(portCounts) {
  const container = document.getElementById('portsSummaryContainer');
  container.innerHTML = `
    <div class="port-box">
      <div class="port-badge-info">
        <span class="port-num">Port 8333</span>
        <span class="port-desc">Bitcoin Mainnet P2P</span>
      </div>
      <span class="port-stats">${portCounts.mainnet} Relays</span>
    </div>
    <div class="port-box">
      <div class="port-badge-info">
        <span class="port-num">Port 18333</span>
        <span class="port-desc">Bitcoin Testnet P2P</span>
      </div>
      <span class="port-stats">${portCounts.testnet} Relays</span>
    </div>
    <div class="port-box">
      <div class="port-badge-info">
        <span class="port-num">Port 8332</span>
        <span class="port-desc">Bitcoin JSON-RPC</span>
      </div>
      <span class="port-stats">${portCounts.rpc} Relays</span>
    </div>
  `;
}

function updateTransactionsTable(transactions) {
  const tbody = document.getElementById('transactionsTableBody');
  tbody.innerHTML = '';
  
  const search = (document.getElementById('tableSearchInput')?.value || '').toLowerCase();
  const typoFilter = document.getElementById('tableTypologySelect')?.value || 'ALL';
  const riskFilter = document.getElementById('tableRiskSelect')?.value || 'ALL';
  
  const filtered = transactions.filter(tx => {
    if (typoFilter !== 'ALL' && !tx.tags.includes(typoFilter)) return false;
    if (riskFilter === 'HIGH' && tx.riskScore < 0.75) return false;
    if (riskFilter === 'MEDIUM' && (tx.riskScore < 0.35 || tx.riskScore >= 0.75)) return false;
    if (riskFilter === 'LOW' && tx.riskScore >= 0.35) return false;
    
    if (search) {
      const matchTx = tx.txid.toLowerCase().includes(search);
      const matchIn = tx.input_addresses.some(a => a.toLowerCase().includes(search));
      const matchOut = tx.output_addresses.some(a => a.toLowerCase().includes(search));
      const matchGeo = tx.geo_country.toLowerCase().includes(search);
      if (!matchTx && !matchIn && !matchOut && !matchGeo) return false;
    }
    return true;
  });
  
  document.getElementById('tableFilterCount').textContent = `Showing ${filtered.length} of ${transactions.length} Transactions`;
  
  filtered.forEach(tx => {
    const tr = document.createElement('tr');
    if (state.selectedTxId === tx.txid) tr.classList.add('active-row');
    
    const riskPercent = (tx.riskScore * 100).toFixed(0);
    const riskBadgeClass = tx.riskScore >= 0.75 ? 'danger' : (tx.riskScore >= 0.35 ? 'purple' : 'neutral');
    
    tr.innerHTML = `
      <td><span class="table-txid">${tx.txid}</span></td>
      <td>${tx.timestamp.replace('T', ' ').replace('Z', '')}</td>
      <td>${tx.input_addresses.length} in (${tx.totalInputBtc.toFixed(4)} BTC)</td>
      <td>${tx.output_addresses.length} out (${tx.totalOutputBtc.toFixed(4)} BTC)</td>
      <td class="font-mono">${tx.totalOutputBtc.toFixed(4)} BTC</td>
      <td class="font-mono">${tx.feeBtc.toFixed(6)}</td>
      <td><span class="table-pill tag-${tx.primaryTypology.toLowerCase()}">${tx.primaryTypology}</span></td>
      <td>${tx.geo_country} • ASN ${tx.asn}</td>
      <td><span class="kpi-badge ${riskBadgeClass}">${riskPercent}%</span></td>
      <td><button class="btn btn-secondary btn-sm btn-inspect-row">Inspect</button></td>
    `;
    
    tr.addEventListener('click', (e) => {
      selectTx(tx.txid);
    });
    
    tr.querySelector('.btn-inspect-row').addEventListener('click', (e) => {
      e.stopPropagation();
      openTxModal(tx);
    });
    
    tbody.appendChild(tr);
  });
}

function selectNode(nodeId) {
  state.selectedNodeId = nodeId;
  const node = state.nodeMap.get(nodeId);
  if (!node) return;
  
  // Highlight connected neighborhood
  state.highlightedNodes.clear();
  state.highlightedEdges.clear();
  
  state.highlightedNodes.add(nodeId);
  state.edges.forEach(e => {
    if (e.source === nodeId || e.target === nodeId) {
      state.highlightedEdges.add(e.id);
      state.highlightedNodes.add(e.source);
      state.highlightedNodes.add(e.target);
    }
  });
  
  if (node.type === 'transaction') {
    state.selectedTxId = node.id;
  }
  
  updateInspectorPanel(node);
  updateTransactionsTable(state.analyzedData.transactions);
}

function selectTx(txid) {
  state.selectedTxId = txid;
  selectNode(txid);
  
  const node = state.nodeMap.get(txid);
  if (node && graphRenderer) {
    graphRenderer.zoomToNode(node);
  }
}

function updateInspectorPanel(node) {
  const emptyState = document.getElementById('inspectorEmpty');
  const detailsState = document.getElementById('inspectorDetails');
  
  emptyState.style.display = 'none';
  detailsState.style.display = 'flex';
  
  document.getElementById('inspNodeTypeBadge').textContent = node.type === 'transaction' ? 'Transaction' : 'Address Entity';
  document.getElementById('inspNodeId').textContent = node.fullLabel;
  
  const riskPill = document.getElementById('inspRiskPill');
  const riskPct = (node.riskScore * 100).toFixed(0);
  riskPill.textContent = `Risk: ${riskPct}%`;
  riskPill.className = 'inspector-risk-pill ' + (node.riskScore >= 0.75 ? 'risk-high' : (node.riskScore >= 0.35 ? 'risk-med' : ''));
  
  document.getElementById('inspRiskScoreVal').textContent = `${node.riskScore.toFixed(2)} / 1.00`;
  document.getElementById('inspRiskBar').style.width = `${riskPct}%`;
  
  const distText = node.seedDistance === 0 ? '0 Hops (Direct Anchor)' : (node.seedDistance < Infinity ? `${node.seedDistance} Hops from Illicit Seed` : 'No Connection Found');
  document.getElementById('inspSeedDistVal').textContent = distText;
  
  // Tags container
  const tagsContainer = document.getElementById('inspTagsContainer');
  tagsContainer.innerHTML = '';
  const tags = node.type === 'transaction' ? node.data.tags : Array.from(node.data.tags || [node.typology]);
  tags.forEach(t => {
    const span = document.createElement('span');
    span.className = `tag-pill tag-${t.toLowerCase()}`;
    span.textContent = t;
    tagsContainer.appendChild(span);
  });
  
  // Inflow / Outflow
  if (node.type === 'transaction') {
    document.getElementById('inspInflow').textContent = `${node.data.totalInputBtc.toFixed(4)} BTC`;
    document.getElementById('inspOutflow').textContent = `${node.data.totalOutputBtc.toFixed(4)} BTC`;
  } else {
    document.getElementById('inspInflow').textContent = `${node.inflow.toFixed(4)} BTC`;
    document.getElementById('inspOutflow').textContent = `${node.outflow.toFixed(4)} BTC`;
  }
  
  // Network Context
  const netSec = document.getElementById('inspNetworkSection');
  if (node.type === 'transaction') {
    netSec.style.display = 'flex';
    document.getElementById('inspGeoAsn').textContent = `${node.data.geo_country} • ASN ${node.data.asn}`;
    document.getElementById('inspIpPort').textContent = `${node.data.src_ip}:${node.data.src_port} ➔ ${node.data.dst_ip}:${node.data.dst_port}`;
    document.getElementById('inspTimestamp').textContent = node.data.timestamp.replace('T', ' ').replace('Z', ' UTC');
  } else {
    netSec.style.display = 'none';
  }
  
  // UTXO list
  const utxoList = document.getElementById('inspUtxoList');
  utxoList.innerHTML = '';
  
  if (node.type === 'transaction') {
    document.getElementById('inspUtxoListTitle').textContent = 'Inputs & Outputs Breakdown';
    node.data.input_addresses.forEach((inAddr, idx) => {
      const row = document.createElement('div');
      row.className = 'utxo-row';
      row.innerHTML = `<span class="utxo-addr">IN: ${inAddr}</span><span class="utxo-amt text-danger">-${node.data.input_amounts[idx]?.toFixed(4)} BTC</span>`;
      row.querySelector('.utxo-addr').addEventListener('click', () => selectNode(inAddr));
      utxoList.appendChild(row);
    });
    node.data.output_addresses.forEach((outAddr, idx) => {
      const row = document.createElement('div');
      row.className = 'utxo-row';
      row.innerHTML = `<span class="utxo-addr">OUT: ${outAddr}</span><span class="utxo-amt text-success">+${node.data.output_amounts[idx]?.toFixed(4)} BTC</span>`;
      row.querySelector('.utxo-addr').addEventListener('click', () => selectNode(outAddr));
      utxoList.appendChild(row);
    });
  } else {
    document.getElementById('inspUtxoListTitle').textContent = 'Participating Transactions';
    node.data.inputTxs.forEach(txid => {
      const row = document.createElement('div');
      row.className = 'utxo-row';
      row.innerHTML = `<span class="utxo-addr">Spent in: ${txid}</span>`;
      row.querySelector('.utxo-addr').addEventListener('click', () => selectTx(txid));
      utxoList.appendChild(row);
    });
    node.data.outputTxs.forEach(txid => {
      const row = document.createElement('div');
      row.className = 'utxo-row';
      row.innerHTML = `<span class="utxo-addr">Received in: ${txid}</span>`;
      row.querySelector('.utxo-addr').addEventListener('click', () => selectTx(txid));
      utxoList.appendChild(row);
    });
  }
}

function openTxModal(tx) {
  const modal = document.getElementById('txModal');
  document.getElementById('modalTxid').textContent = tx.txid;
  document.getElementById('modalTypologyBadge').textContent = tx.primaryTypology;
  
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div class="insp-metrics-grid">
        <div class="insp-metric-box">
          <span class="metric-label">Timestamp</span>
          <span class="metric-val">${tx.timestamp}</span>
        </div>
        <div class="insp-metric-box">
          <span class="metric-label">Fee</span>
          <span class="metric-val">${tx.feeBtc.toFixed(6)} BTC</span>
        </div>
        <div class="insp-metric-box">
          <span class="metric-label">Relay Endpoints</span>
          <span class="metric-val font-mono">${tx.src_ip}:${tx.src_port} ➔ ${tx.dst_ip}:${tx.dst_port}</span>
        </div>
        <div class="insp-metric-box">
          <span class="metric-label">Routing Origin</span>
          <span class="metric-val">${tx.geo_country} • ASN ${tx.asn}</span>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="insp-section">
          <div class="section-title">Inputs (${tx.input_addresses.length}) • ${tx.totalInputBtc.toFixed(4)} BTC</div>
          <div class="utxo-list">
            ${tx.input_addresses.map((a, i) => `
              <div class="utxo-row">
                <span class="utxo-addr">${a}</span>
                <span class="utxo-amt text-danger">${tx.input_amounts[i]?.toFixed(4)} BTC</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="insp-section">
          <div class="section-title">Outputs (${tx.output_addresses.length}) • ${tx.totalOutputBtc.toFixed(4)} BTC</div>
          <div class="utxo-list">
            ${tx.output_addresses.map((a, i) => `
              <div class="utxo-row">
                <span class="utxo-addr">${a}</span>
                <span class="utxo-amt text-success">${tx.output_amounts[i]?.toFixed(4)} BTC</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

function shortenString(str, len) {
  if (!str || str.length <= len) return str;
  return str.slice(0, 5) + '..' + str.slice(-4);
}

// ==========================================================================
// Dataset Loader & Switcher
// ==========================================================================

function loadDataset(type, customData = null) {
  state.currentDataset = type;
  
  // Highlight dataset button
  document.querySelectorAll('.dataset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dataset === type);
  });
  
  let txList = [];
  let seedList = [];
  
  if (customData) {
    txList = customData.txs;
    seedList = customData.seeds || [];
  } else if (type === 'json') {
    txList = EMBEDDED_DATA.json.txs;
    seedList = EMBEDDED_DATA.json.seeds;
  } else if (type === 'csv') {
    txList = parseCsvData(EMBEDDED_DATA.csv.raw, EMBEDDED_DATA.csv.seeds);
    seedList = EMBEDDED_DATA.csv.seeds;
  } else if (type === 'xml') {
    txList = parseXmlData(EMBEDDED_DATA.xml.raw, EMBEDDED_DATA.xml.seeds);
    seedList = EMBEDDED_DATA.xml.seeds;
  }
  
  state.rawTransactions = txList;
  state.seedLabels = seedList;
  
  // Perform Forensic Analysis
  state.analyzedData = analyzeDataset(txList, seedList);
  
  // Update UI components
  updateKpiCards(state.analyzedData.metrics);
  updateTypologyBars(state.analyzedData.metrics.typologyCounts, state.analyzedData.metrics.totalTx);
  updateGeoBars(state.analyzedData.metrics.geoCounts, state.analyzedData.metrics.asnCounts, state.analyzedData.metrics.totalTx);
  updatePortStats(state.analyzedData.metrics.portCounts);
  updateTransactionsTable(state.analyzedData.transactions);
  
  // Rebuild Graph
  rebuildGraph();
  showToast(`Loaded ${type.toUpperCase()} Dataset (${txList.length} Transactions)`);
}

function rebuildGraph() {
  if (!state.analyzedData) return;
  
  const { nodes, edges, nodeMap } = buildGraphElements(
    state.analyzedData,
    state.viewMode,
    state.typologyFilter,
    state.riskFilter
  );
  
  state.nodes = nodes;
  state.edges = edges;
  state.nodeMap = nodeMap;
  
  document.getElementById('graphElementsCount').textContent = `${nodes.length} Nodes • ${edges.length} Edges`;
  
  if (state.layoutMode === 'hierarchical') {
    applyHierarchicalLayout(nodes, edges, state.analyzedData.transactions);
  }
  
  if (graphRenderer) {
    graphRenderer.fitToScreen();
  }
}

function applyFilters() {
  state.typologyFilter = document.getElementById('selectTypologyFilter').value;
  state.riskFilter = document.getElementById('selectRiskFilter').value;
  rebuildGraph();
  updateTransactionsTable(state.analyzedData.transactions);
}

// ==========================================================================
// Initialization & Event Binding
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('graphCanvas');
  const container = document.getElementById('graphViewport');
  graphRenderer = new GraphCanvasRenderer(canvas, container);
  graphRenderer.start();
  
  // 1. Initial Dataset Load
  loadDataset('json');
  
  // 2. Dataset Switcher Buttons
  document.getElementById('btnDsJson').addEventListener('click', () => loadDataset('json'));
  document.getElementById('btnDsCsv').addEventListener('click', () => loadDataset('csv'));
  document.getElementById('btnDsXml').addEventListener('click', () => loadDataset('xml'));
  
  // 3. View Mode Toggle
  document.getElementById('btnViewBipartite').addEventListener('click', e => {
    state.viewMode = 'bipartite';
    document.getElementById('btnViewBipartite').classList.add('active');
    document.getElementById('btnViewDirect').classList.remove('active');
    rebuildGraph();
  });
  
  document.getElementById('btnViewDirect').addEventListener('click', e => {
    state.viewMode = 'direct';
    document.getElementById('btnViewDirect').classList.add('active');
    document.getElementById('btnViewBipartite').classList.remove('active');
    rebuildGraph();
  });
  
  // 4. Layout Mode Toggle
  document.getElementById('btnLayoutForce').addEventListener('click', () => {
    state.layoutMode = 'force';
    state.physicsEnabled = true;
    document.getElementById('btnLayoutForce').classList.add('active');
    document.getElementById('btnLayoutHierarchical').classList.remove('active');
    document.getElementById('physicsIcon').textContent = '⏸️';
    rebuildGraph();
  });
  
  document.getElementById('btnLayoutHierarchical').addEventListener('click', () => {
    state.layoutMode = 'hierarchical';
    document.getElementById('btnLayoutHierarchical').classList.add('active');
    document.getElementById('btnLayoutForce').classList.remove('active');
    rebuildGraph();
  });
  
  // 5. Physics Freeze Toggle
  document.getElementById('btnFreezePhysics').addEventListener('click', () => {
    state.physicsEnabled = !state.physicsEnabled;
    document.getElementById('physicsIcon').textContent = state.physicsEnabled ? '⏸️' : '▶️';
    showToast(state.physicsEnabled ? 'Physics Simulation Resumed' : 'Physics Simulation Frozen');
  });
  
  // 6. Zoom & Fit Controls
  document.getElementById('btnZoomIn').addEventListener('click', () => {
    state.camera.zoom = Math.min(4.0, state.camera.zoom * 1.25);
  });
  document.getElementById('btnZoomOut').addEventListener('click', () => {
    state.camera.zoom = Math.max(0.15, state.camera.zoom * 0.8);
  });
  document.getElementById('btnFitGraph').addEventListener('click', () => {
    graphRenderer.fitToScreen();
  });
  document.getElementById('btnResetHighlights').addEventListener('click', () => {
    state.selectedNodeId = null;
    state.selectedTxId = null;
    state.highlightedNodes.clear();
    state.highlightedEdges.clear();
    state.traversalPath = null;
    document.getElementById('traversalBanner').style.display = 'none';
    document.getElementById('inspectorEmpty').style.display = 'flex';
    document.getElementById('inspectorDetails').style.display = 'none';
    updateTransactionsTable(state.analyzedData.transactions);
  });
  
  // 7. Trace Seed Path Action
  function triggerTraceSeed() {
    const targetId = state.selectedNodeId || (state.nodes[0] ? state.nodes[0].id : null);
    if (!targetId) {
      showToast('Select a node first to trace path to seed');
      return;
    }
    
    const result = traceShortestPathToSeed(targetId);
    if (result && result.path.length > 0) {
      state.traversalPath = result;
      state.highlightedNodes.clear();
      state.highlightedEdges = new Set(result.edgeIds);
      result.path.forEach(id => state.highlightedNodes.add(id));
      
      const banner = document.getElementById('traversalBanner');
      document.getElementById('traversalText').textContent = `Path from ${shortenString(targetId, 8)} to Illicit Seed Anchor (${result.hops} Hops)`;
      banner.style.display = 'flex';
      
      showToast(`Found path with ${result.hops} hops to illicit seed entity`);
    } else {
      showToast('No path to illicit seed anchor found for this node');
    }
  }
  
  document.getElementById('btnTraceSeedPath').addEventListener('click', triggerTraceSeed);
  document.getElementById('btnInspTraceSeed').addEventListener('click', triggerTraceSeed);
  
  document.getElementById('btnCloseBanner').addEventListener('click', () => {
    document.getElementById('traversalBanner').style.display = 'none';
    state.traversalPath = null;
  });
  
  // 8. Ancestors & Descendants Actions
  document.getElementById('btnInspTraceUpstream').addEventListener('click', () => {
    if (!state.selectedNodeId) return;
    const upstream = traceAncestors(state.selectedNodeId);
    state.highlightedNodes = upstream;
    state.highlightedEdges.clear();
    state.edges.forEach(e => {
      if (upstream.has(e.source) && upstream.has(e.target)) state.highlightedEdges.add(e.id);
    });
    showToast(`Highlighted ${upstream.size} upstream funding nodes`);
  });
  
  document.getElementById('btnInspTraceDownstream').addEventListener('click', () => {
    if (!state.selectedNodeId) return;
    const downstream = traceDescendants(state.selectedNodeId);
    state.highlightedNodes = downstream;
    state.highlightedEdges.clear();
    state.edges.forEach(e => {
      if (downstream.has(e.source) && downstream.has(e.target)) state.highlightedEdges.add(e.id);
    });
    showToast(`Highlighted ${downstream.size} downstream spending nodes`);
  });
  
  // 9. Quick Seed Inspect button in Inspector empty state
  document.getElementById('btnInspectSeedDirect').addEventListener('click', () => {
    const seed = state.seedLabels[0];
    if (seed && state.nodeMap.has(seed.address)) {
      selectNode(seed.address);
      graphRenderer.zoomToNode(state.nodeMap.get(seed.address));
    } else if (seed && seed.first_flagged_txid && state.nodeMap.has(seed.first_flagged_txid)) {
      selectNode(seed.first_flagged_txid);
      graphRenderer.zoomToNode(state.nodeMap.get(seed.first_flagged_txid));
    } else {
      showToast('Seed address not present in current visible filter');
    }
  });
  
  // 10. Filters & Search Handlers
  document.getElementById('selectTypologyFilter').addEventListener('change', applyFilters);
  document.getElementById('selectRiskFilter').addEventListener('change', applyFilters);
  
  document.getElementById('tableTypologySelect').addEventListener('change', () => {
    updateTransactionsTable(state.analyzedData.transactions);
  });
  document.getElementById('tableRiskSelect').addEventListener('change', () => {
    updateTransactionsTable(state.analyzedData.transactions);
  });
  document.getElementById('tableSearchInput').addEventListener('input', () => {
    updateTransactionsTable(state.analyzedData.transactions);
  });
  
  // Graph Search Input
  document.getElementById('graphSearchInput').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      state.highlightedNodes.clear();
      return;
    }
    
    let matched = null;
    state.highlightedNodes.clear();
    state.nodes.forEach(n => {
      if (n.fullLabel.toLowerCase().includes(q)) {
        state.highlightedNodes.add(n.id);
        if (!matched) matched = n;
      }
    });
    
    if (matched) {
      selectNode(matched.id);
      graphRenderer.zoomToNode(matched);
    }
  });
  
  document.getElementById('btnGraphSearchClear').addEventListener('click', () => {
    document.getElementById('graphSearchInput').value = '';
    state.highlightedNodes.clear();
  });
  
  // 11. Modal Controls
  document.getElementById('btnModalClose').addEventListener('click', () => {
    document.getElementById('txModal').style.display = 'none';
  });
  document.getElementById('btnInspOpenTxModal').addEventListener('click', () => {
    const node = state.nodeMap.get(state.selectedNodeId);
    if (node && node.type === 'transaction') {
      openTxModal(node.data);
    } else if (node && node.type === 'address') {
      const txid = node.data.outputTxs[0] || node.data.inputTxs[0];
      const tx = state.analyzedData.transactions.find(t => t.txid === txid);
      if (tx) openTxModal(tx);
    }
  });
  
  // 12. Custom File Upload Modal
  const uploadModal = document.getElementById('uploadModal');
  document.getElementById('btnUploadModal').addEventListener('click', () => {
    uploadModal.style.display = 'flex';
  });
  document.getElementById('btnUploadModalClose').addEventListener('click', () => {
    uploadModal.style.display = 'none';
  });
  
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  
  document.getElementById('btnBrowseFiles').addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleCustomFileUpload(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener('change', e => {
    if (e.target.files.length > 0) {
      handleCustomFileUpload(e.target.files[0]);
    }
  });
  
  function handleCustomFileUpload(file) {
    const reader = new FileReader();
    const name = file.name.toLowerCase();
    
    reader.onload = evt => {
      const content = evt.target.result;
      try {
        let txs = [];
        if (name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          txs = Array.isArray(parsed) ? parsed : (parsed.transactions || []);
        } else if (name.endsWith('.csv')) {
          txs = parseCsvData(content, []);
        } else if (name.endsWith('.xml')) {
          txs = parseXmlData(content, []);
        } else {
          showToast('Unsupported file format. Please upload .json, .csv, or .xml');
          return;
        }
        
        loadDataset('custom', { txs, seeds: state.seedLabels });
        uploadModal.style.display = 'none';
      } catch (err) {
        showToast('Error parsing file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
  
  // 13. Export Report as JSON
  document.getElementById('btnExportJson').addEventListener('click', () => {
    if (!state.analyzedData) return;
    const exportObj = {
      exportTimestamp: new Date().toISOString(),
      dataset: state.currentDataset,
      summary: state.analyzedData.metrics,
      seedLabels: state.seedLabels,
      transactions: state.analyzedData.transactions
    };
    
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitcoin_forensics_report_${state.currentDataset}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Forensic report exported successfully');
  });
});
