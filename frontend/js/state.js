/* state.js — shared application state
   Imported before all other JS modules.
   Mutate via the setters so watchers can be added later. */

const State = (() => {
  const _s = {
    caseId:          'CASE_2026_001',
    activeSection:   'dashboard',
    selectedNode:    null,   // { id, type, props }
    alertTypeFilter: 'all',
    graphNodes:      {},     // id → element data (prevent reload on expand)
    graphEdges:      {},     // id → element data
    charts:          {},     // keyed by canvas id
  };

  return {
    get(k)      { return _s[k]; },
    set(k, v)   { _s[k] = v; return v; },
    all()       { return { ..._s }; },

    getCase()   { return _s.caseId; },
    setCase(v)  { _s.caseId = v; },

    getSection()  { return _s.activeSection; },
    setSection(v) { _s.activeSection = v; },

    getSelected()  { return _s.selectedNode; },
    setSelected(n) { _s.selectedNode = n; },

    addGraphNode(id, data) { _s.graphNodes[id] = data; },
    addGraphEdge(id, data) { _s.graphEdges[id] = data; },
    hasGraphNode(id)       { return id in _s.graphNodes; },
    hasGraphEdge(id)       { return id in _s.graphEdges; },
    clearGraph()           { _s.graphNodes = {}; _s.graphEdges = {}; },

    setChart(key, inst) { _s.charts[key] = inst; },
    getChart(key)       { return _s.charts[key]; },
    destroyChart(key) {
      if (_s.charts[key]) { _s.charts[key].destroy(); delete _s.charts[key]; }
    },
  };
})();
